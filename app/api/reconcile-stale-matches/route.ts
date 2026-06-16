import { NextResponse } from 'next/server'
import {
  deriveMatchUpdateFromFixture,
  fetchFixtureById,
} from '@/src/lib/api-football'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { secureCompare } from '@/src/lib/secure-compare'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STALE_CUTOFF_MINUTES = 135
/** Force-close when API feed is still "live" this long after kickoff. Safe for
 *  standard group matches (~90+ stoppage). Raise or make round-aware before
 *  syncing knockout extra time / penalties (feed can stay live 120+ min). */
const FORCE_FINAL_MINUTES = 135
const MAX_CANDIDATES = 20

type ReconcileError = {
  fixtureId: string
  message: string
}

type CandidateRow = {
  id: string
  fixture_id: string
  team1_name: string
  team2_name: string
  result_team1: number | null
  result_team2: number | null
  is_final: boolean
  kickoff_at: string
  status_short: string | null
  elapsed_minute: number | null
}

type MatchLiveUpdatePayload = {
  status_short: string
  elapsed_minute?: number
  updated_at?: string
  result_team1?: number
  result_team2?: number
}

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null
  if (bearerToken && secureCompare(bearerToken, cronSecret)) return true

  const cronHeader = request.headers.get('x-cron-secret')
  if (cronHeader && secureCompare(cronHeader, cronSecret)) return true

  return false
}

async function runReconcile(): Promise<{
  candidates: number
  finalized: number
  stillLive: number
  alerted: number
  errors: ReconcileError[]
}> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured')
  }

  const supabase = createAdminSupabaseClient()
  const kickoffCutoff = new Date(
    Date.now() - STALE_CUTOFF_MINUTES * 60_000,
  ).toISOString()

  const { data: candidateRows, error: loadError } = await supabase
    .from('matches')
    .select(
      'id, fixture_id, team1_name, team2_name, result_team1, result_team2, is_final, kickoff_at, status_short, elapsed_minute',
    )
    .eq('is_final', false)
    .lt('kickoff_at', kickoffCutoff)
    .order('kickoff_at', { ascending: true })
    .limit(MAX_CANDIDATES)

  if (loadError) {
    throw new Error(`Failed to load stale matches: ${loadError.message}`)
  }

  const candidates = (candidateRows ?? []) as CandidateRow[]

  let finalized = 0
  let stillLive = 0
  let alerted = 0
  const errors: ReconcileError[] = []

  for (const match of candidates) {
    const fixtureId = match.fixture_id
    const label = `${match.team1_name} v ${match.team2_name}`

    let fixture
    try {
      fixture = await fetchFixtureById(apiKey, fixtureId)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'API-Football fetch failed'
      errors.push({ fixtureId, message })
      continue
    }

    if (!fixture) {
      alerted += 1
      try {
        await sendOpsNtfy(
          `Warning: stale match ${label} (fixture ${fixtureId}): API returned no fixture`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
      continue
    }

    const update = deriveMatchUpdateFromFixture(fixture)
    if (!update) {
      alerted += 1
      const apiStatus = fixture.fixture.status.short
      try {
        await sendOpsNtfy(
          `Warning: stale match ${label} (fixture ${fixtureId}): API status "${apiStatus}" is not reconcilable`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
      continue
    }

    if (update.is_final) {
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          result_team1: update.result_team1,
          result_team2: update.result_team2,
          is_final: true,
          status_short: update.status_short,
          elapsed_minute: update.elapsed_minute,
        })
        .eq('id', match.id)

      if (updateError) {
        errors.push({ fixtureId, message: updateError.message })
        continue
      }

      const { error: rpcError } = await supabase.rpc('calculate_match_points', {
        p_match_id: match.id,
      })

      if (rpcError) {
        errors.push({
          fixtureId,
          message: `calculate_match_points: ${rpcError.message}`,
        })
        try {
          await sendOpsNtfy(
            `Error: reconciled ${label} (fixture ${fixtureId}) in DB but calculate_match_points failed: ${rpcError.message}`,
          )
        } catch (notifyError) {
          console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
        }
        continue
      }

      finalized += 1
      const score = `${update.result_team1}-${update.result_team2}`
      try {
        await sendOpsNtfy(
          `Reconciled ${label} -> ${score} ${update.status_short}`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
      continue
    }

    const minutesSinceKickoff =
      (Date.now() - new Date(match.kickoff_at).getTime()) / 60_000

    if (minutesSinceKickoff > FORCE_FINAL_MINUTES) {
      const nowIso = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          result_team1: update.result_team1,
          result_team2: update.result_team2,
          is_final: true,
          status_short: 'FT',
          updated_at: nowIso,
        })
        .eq('id', match.id)

      if (updateError) {
        errors.push({ fixtureId, message: updateError.message })
        continue
      }

      const { error: rpcError } = await supabase.rpc('calculate_match_points', {
        p_match_id: match.id,
      })

      if (rpcError) {
        errors.push({
          fixtureId,
          message: `calculate_match_points: ${rpcError.message}`,
        })
        try {
          await sendOpsNtfy(
            `Error: auto-closed ${label} (fixture ${fixtureId}) in DB but calculate_match_points failed: ${rpcError.message}`,
          )
        } catch (notifyError) {
          console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
        }
        continue
      }

      finalized += 1
      const score = `${update.result_team1}-${update.result_team2}`
      try {
        await sendOpsNtfy(
          `Auto-closed ${label} (fixture ${fixtureId}) on last known score ${score} FT — API feed was still live ${Math.floor(minutesSinceKickoff)}m after kickoff. Sanity-check this result.`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
      continue
    }

    stillLive += 1

    const apiElapsed = update.elapsed_minute
    const apiStatusShort = update.status_short

    const scoreOrFinalChanged =
      match.result_team1 !== update.result_team1 ||
      match.result_team2 !== update.result_team2

    const elapsedChanged =
      apiElapsed != null && apiElapsed !== match.elapsed_minute

    const statusChanged = apiStatusShort !== match.status_short

    if (!scoreOrFinalChanged && !elapsedChanged && !statusChanged) {
      continue
    }

    const updatePayload: MatchLiveUpdatePayload = {
      status_short: apiStatusShort,
    }

    if (apiElapsed != null) {
      updatePayload.elapsed_minute = apiElapsed
    }

    if (elapsedChanged) {
      updatePayload.updated_at = new Date().toISOString()
    }

    if (scoreOrFinalChanged) {
      updatePayload.result_team1 = update.result_team1
      updatePayload.result_team2 = update.result_team2
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(updatePayload)
      .eq('id', match.id)

    if (updateError) {
      errors.push({ fixtureId, message: updateError.message })
    }
  }

  return {
    candidates: candidates.length,
    finalized,
    stillLive,
    alerted,
    errors,
  }
}

async function handleReconcileRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await runReconcile()
    return NextResponse.json({
      success: true,
      ...summary,
    })
  } catch (error) {
    console.error('reconcile-stale-matches error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleReconcileRequest(request)
}

export async function POST(request: Request) {
  return handleReconcileRequest(request)
}
