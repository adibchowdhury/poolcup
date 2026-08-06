import { NextResponse } from 'next/server'
import {
  deriveMatchUpdateFromFixture,
  fetchFixtureById,
  resolveFixtureScoresForForceClose,
  type ApiFootballFixture,
} from '@/src/lib/api-football'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'
import { knockoutFinalizeFieldsFromFixture } from '@/src/lib/match-finalize'
import {
  canFinalizeMatchByKickoff,
  isValidApiFootballFixtureId,
  logUpdaterGuardWarning,
} from '@/src/lib/match-updater-guards'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { tryPostMatchMoments } from '@/src/lib/post-match-moments'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { secureCompare } from '@/src/lib/secure-compare'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STALE_CUTOFF_MINUTES = 135
/** Force-close when API feed is still "live" this long after kickoff. Group matches only. */
const FORCE_FINAL_MINUTES = 135
/** Only force-close when the feed still looks like late live play, not halftime or suspended. */
const FORCE_CLOSE_MIN_ELAPSED_MINUTE = 85
/** Hard catch-all: wall-clock threshold past which any stuck live status (incl. HT) may close. */
const FORCE_CLOSE_HARD_MINUTES = 155

const FORCE_CLOSE_ELIGIBLE_STATUSES = new Set([
  '2H',
  'ET',
  'BT',
  'P',
  'LIVE',
])

const FORCE_CLOSE_BLOCKED_STATUSES = new Set([
  '1H',
  'HT',
  'NS',
  'TBD',
  'SUSP',
  'INT',
  'PST',
  'ABD',
  'CANC',
  'AWD',
  'WO',
  'ET',
  'P',
])

/** Never hard force-close postponed/cancelled fixtures. */
const HARD_FORCE_CLOSE_BLOCKED_STATUSES = new Set([
  'NS',
  'TBD',
  'PST',
  'ABD',
  'CANC',
  'AWD',
  'WO',
])

const DEFAULT_MAX_CANDIDATES = 50

function getMaxCandidates(): number {
  const raw = process.env.RECONCILE_MAX_CANDIDATES
  if (!raw) return DEFAULT_MAX_CANDIDATES
  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_CANDIDATES
  return Math.min(parsed, 200)
}

type ReconcileError = {
  fixtureId: string
  message: string
}

type CandidateRow = {
  id: string
  fixture_id: string | null
  round: string
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
  advancing_team?: number
}

function canForceCloseStaleMatch(
  round: string,
  statusShort: string,
  elapsedMinute: number | null,
  minutesSinceKickoff: number,
): boolean {
  if (isKnockoutRound(round)) return false
  const status = statusShort.trim().toUpperCase()
  if (FORCE_CLOSE_BLOCKED_STATUSES.has(status)) return false
  if (!FORCE_CLOSE_ELIGIBLE_STATUSES.has(status)) return false
  if (elapsedMinute == null || elapsedMinute < FORCE_CLOSE_MIN_ELAPSED_MINUTE) {
    return false
  }
  return minutesSinceKickoff > FORCE_FINAL_MINUTES
}

function canHardForceCloseStaleMatch(
  round: string,
  statusShort: string,
  minutesSinceKickoff: number,
): boolean {
  if (isKnockoutRound(round)) return false
  const status = statusShort.trim().toUpperCase()
  if (HARD_FORCE_CLOSE_BLOCKED_STATUSES.has(status)) return false
  if (status === 'ET' || status === 'P') return false
  return minutesSinceKickoff > FORCE_CLOSE_HARD_MINUTES
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

async function finalizeForceClosedMatch(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  match: CandidateRow,
  label: string,
  fixtureId: string,
  resultTeam1: number,
  resultTeam2: number,
  ntfyMessage: string,
): Promise<'finalized' | 'update_error' | 'rpc_error'> {
  const nowIso = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('matches')
    .update({
      result_team1: resultTeam1,
      result_team2: resultTeam2,
      is_final: true,
      status_short: 'FT',
      updated_at: nowIso,
    })
    .eq('id', match.id)

  if (updateError) {
    return 'update_error'
  }

  const { error: rpcError } = await supabase.rpc('calculate_match_points', {
    p_match_id: match.id,
  })

  if (rpcError) {
    try {
      await sendOpsNtfy(
        `Error: auto-closed ${label} (fixture ${fixtureId}) in DB but calculate_match_points failed: ${rpcError.message}`,
      )
    } catch (notifyError) {
      console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
    }
    return 'rpc_error'
  }

  await tryPostMatchMoments(
    supabase,
    match.id,
    'reconcile-stale-matches:force-close',
  )

  try {
    await sendOpsNtfy(ntfyMessage)
  } catch (notifyError) {
    console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
  }

  return 'finalized'
}

type ForceCloseKind = 'gentle' | 'hard'

async function attemptForceCloseWithResolvedScore(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  match: CandidateRow,
  label: string,
  fixtureId: string,
  fixture: ApiFootballFixture,
  update: { status_short: string; elapsed_minute: number | null },
  minutesSinceKickoff: number,
  kind: ForceCloseKind,
): Promise<'finalized' | 'no_score' | 'update_error' | 'rpc_error'> {
  const scores = resolveFixtureScoresForForceClose(
    fixture,
    match.result_team1,
    match.result_team2,
  )

  if (!scores) {
    const thresholdMinutes =
      kind === 'hard' ? FORCE_CLOSE_HARD_MINUTES : FORCE_FINAL_MINUTES
    try {
      await sendOpsNtfy(
        `Warning: stale match ${label} (fixture ${fixtureId}) past ${thresholdMinutes}m kickoff but no reliable score from API or DB — cannot ${kind} force-close.`,
      )
    } catch (notifyError) {
      console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
    }
    return 'no_score'
  }

  const ntfyMessage =
    kind === 'gentle'
      ? `Auto-closed ${label} (fixture ${fixtureId}) on score ${scores.resultTeam1}-${scores.resultTeam2} FT — feed still ${update.status_short} ${update.elapsed_minute ?? '?'}' ${Math.floor(minutesSinceKickoff)}m after kickoff. Sanity-check this result.`
      : `Hard auto-closed ${label} (fixture ${fixtureId}) on score ${scores.resultTeam1}-${scores.resultTeam2} FT — API still ${update.status_short} ${Math.floor(minutesSinceKickoff)}m after kickoff. Sanity-check this result.`

  return finalizeForceClosedMatch(
    supabase,
    match,
    label,
    fixtureId,
    scores.resultTeam1,
    scores.resultTeam2,
    ntfyMessage,
  )
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
  const maxCandidates = getMaxCandidates()

  const { data: candidateRows, error: loadError } = await supabase
    .from('matches')
    .select(
      'id, fixture_id, round, team1_name, team2_name, result_team1, result_team2, is_final, kickoff_at, status_short, elapsed_minute',
    )
    .eq('is_final', false)
    .lt('kickoff_at', kickoffCutoff)
    .order('kickoff_at', { ascending: true })
    .limit(maxCandidates)

  if (loadError) {
    throw new Error(`Failed to load stale matches: ${loadError.message}`)
  }

  const candidates = (candidateRows ?? []) as CandidateRow[]

  let finalized = 0
  let stillLive = 0
  let alerted = 0
  const errors: ReconcileError[] = []

  for (const match of candidates) {
    const label = `${match.team1_name} v ${match.team2_name}`

    if (!isValidApiFootballFixtureId(match.fixture_id)) {
      logUpdaterGuardWarning(
        'reconcile-stale-matches',
        'Skipping match with invalid or placeholder fixture_id — will not poll API',
        {
          matchId: match.id,
          fixtureId: match.fixture_id,
          kickoffAt: match.kickoff_at,
        },
      )
      stillLive += 1
      continue
    }

    const fixtureId = match.fixture_id as string

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
      if (!canFinalizeMatchByKickoff(match.kickoff_at)) {
        logUpdaterGuardWarning(
          'reconcile-stale-matches',
          'Refusing early finalize — API reported FT before minimum kickoff window elapsed',
          {
            matchId: match.id,
            fixtureId,
            kickoffAt: match.kickoff_at,
            apiStatus: update.status_short,
            minutesSinceKickoff: Math.floor(
              (Date.now() - new Date(match.kickoff_at).getTime()) / 60_000,
            ),
          },
        )
        stillLive += 1
        continue
      }

      const finalizePayload: {
        result_team1: number
        result_team2: number
        is_final: true
        status_short: string
        elapsed_minute: number | null
        advancing_team?: number
      } = {
        result_team1: update.result_team1,
        result_team2: update.result_team2,
        is_final: true,
        status_short: update.status_short,
        elapsed_minute: update.elapsed_minute,
      }

      if (isKnockoutRound(match.round)) {
        const knockoutFields = knockoutFinalizeFieldsFromFixture(
          match.round,
          fixture,
        )
        if (!knockoutFields) {
          stillLive += 1
          errors.push({
            fixtureId,
            message:
              'Knockout finalize blocked: level score without advancing team',
          })
          continue
        }
        finalizePayload.advancing_team = knockoutFields.advancing_team
      }

      const { error: updateError } = await supabase
        .from('matches')
        .update(finalizePayload)
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

      await tryPostMatchMoments(
        supabase,
        match.id,
        'reconcile-stale-matches',
      )

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

    if (
      canForceCloseStaleMatch(
        match.round,
        update.status_short,
        update.elapsed_minute,
        minutesSinceKickoff,
      )
    ) {
      const closeResult = await attemptForceCloseWithResolvedScore(
        supabase,
        match,
        label,
        fixtureId,
        fixture,
        update,
        minutesSinceKickoff,
        'gentle',
      )

      if (closeResult === 'no_score') {
        alerted += 1
        stillLive += 1
        continue
      }
      if (closeResult === 'update_error') {
        errors.push({ fixtureId, message: 'Force-close update failed' })
        continue
      }
      if (closeResult === 'rpc_error') {
        errors.push({
          fixtureId,
          message: 'calculate_match_points failed after force-close',
        })
        continue
      }

      finalized += 1
      continue
    }

    if (
      canHardForceCloseStaleMatch(
        match.round,
        update.status_short,
        minutesSinceKickoff,
      )
    ) {
      const closeResult = await attemptForceCloseWithResolvedScore(
        supabase,
        match,
        label,
        fixtureId,
        fixture,
        update,
        minutesSinceKickoff,
        'hard',
      )

      if (closeResult === 'no_score') {
        alerted += 1
        stillLive += 1
        continue
      }
      if (closeResult === 'update_error') {
        errors.push({ fixtureId, message: 'Hard force-close update failed' })
        continue
      }
      if (closeResult === 'rpc_error') {
        errors.push({
          fixtureId,
          message: 'calculate_match_points failed after hard force-close',
        })
        continue
      }

      finalized += 1
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
      alerted += 1
      try {
        await sendOpsNtfy(
          `Stale non-final match unchanged: ${label} (fixture ${fixtureId}) — API ${apiStatusShort} ${apiElapsed ?? '?'}' — ${Math.floor(minutesSinceKickoff)}m after kickoff. Reconcile could not advance; manual check may be needed.`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
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
