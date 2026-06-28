import { NextResponse } from 'next/server'
import {
  fetchFixturesByIds,
  isFinalStatus,
  isSyncableStatus,
  LIVE_MATCH_STATUSES,
  parseFixtureGoals,
  todayUtcDateString,
} from '@/src/lib/api-football'
import { knockoutFinalizeFieldsFromFixture } from '@/src/lib/match-finalize'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { secureCompare } from '@/src/lib/secure-compare'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SyncError = {
  fixtureId: string
  message: string
}

type MatchRow = {
  id: string
  fixture_id: string
  round: string
  kickoff_at: string
  result_team1: number | null
  result_team2: number | null
  is_final: boolean
  status_short: string | null
  elapsed_minute: number | null
}

type MatchLiveUpdatePayload = {
  status_short: string
  elapsed_minute?: number
  updated_at?: string
  result_team1?: number
  result_team2?: number
  is_final?: boolean
  advancing_team?: number
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

/** Cheap no-op guard: skip the cron when nothing could be in play. */
const LIVE_WINDOW_MAX_AGE_MINUTES = 210
const LIVE_WINDOW_PRE_KICKOFF_MINUTES = 5

/** Upper bound for DB live-match discovery (avoids scanning ancient unfinalized rows). */
const LIVE_MATCH_MAX_AGE_MINUTES = 360

/** Only page ops when a started match is missing from the API for this long. */
const API_MISSING_NTFY_KICKOFF_MINUTES = 60

async function runSync(): Promise<{
  date: string
  matchesChecked: number
  matchesUpdated: number
  matchesSkipped: number
  pointsRecalculated: number
  apiMissing: number
  errors: SyncError[]
  skipped?: string
}> {
  const supabase = createAdminSupabaseClient()
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const windowStart = new Date(
    nowMs - LIVE_WINDOW_MAX_AGE_MINUTES * 60_000,
  ).toISOString()
  const windowEnd = new Date(
    nowMs + LIVE_WINDOW_PRE_KICKOFF_MINUTES * 60_000,
  ).toISOString()
  const liveDiscoveryStart = new Date(
    nowMs - LIVE_MATCH_MAX_AGE_MINUTES * 60_000,
  ).toISOString()

  const { data: liveWindowMatches, error: liveWindowError } = await supabase
    .from('matches')
    .select('id')
    .eq('is_final', false)
    .lte('kickoff_at', windowEnd)
    .gt('kickoff_at', windowStart)
    .limit(1)

  if (liveWindowError) {
    throw new Error(`Failed to check live window: ${liveWindowError.message}`)
  }

  if (!liveWindowMatches?.[0]) {
    return {
      date: todayUtcDateString(),
      matchesChecked: 0,
      matchesUpdated: 0,
      matchesSkipped: 0,
      pointsRecalculated: 0,
      apiMissing: 0,
      errors: [],
      skipped: 'no_live_window',
    }
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured')
  }

  const { data: liveMatchRows, error: loadError } = await supabase
    .from('matches')
    .select(
      'id, fixture_id, round, kickoff_at, result_team1, result_team2, is_final, status_short, elapsed_minute',
    )
    .eq('is_final', false)
    .lte('kickoff_at', nowIso)
    .gt('kickoff_at', liveDiscoveryStart)

  if (loadError) {
    throw new Error(`Failed to load live matches: ${loadError.message}`)
  }

  const matches = (liveMatchRows ?? []) as MatchRow[]

  if (matches.length === 0) {
    return {
      date: todayUtcDateString(),
      matchesChecked: 0,
      matchesUpdated: 0,
      matchesSkipped: 0,
      pointsRecalculated: 0,
      apiMissing: 0,
      errors: [],
    }
  }

  const fixtureIds = matches.map((m) => m.fixture_id)
  const fixtures = await fetchFixturesByIds(apiKey, fixtureIds)

  const fixtureById = new Map<string, (typeof fixtures)[number]>()
  for (const fixture of fixtures) {
    fixtureById.set(String(fixture.fixture.id), fixture)
  }

  let matchesUpdated = 0
  let matchesSkipped = 0
  let pointsRecalculated = 0
  const errors: SyncError[] = []
  const apiMissingAlerts: string[] = []

  for (const match of matches) {
    const fixtureId = match.fixture_id
    const fixture = fixtureById.get(fixtureId)

    if (!fixture) {
      console.error('sync-scores: API missing fixture for DB live match', {
        matchId: match.id,
        fixtureId,
        kickoffAt: match.kickoff_at,
        statusShort: match.status_short,
      })

      const minutesSinceKickoff =
        (nowMs - new Date(match.kickoff_at).getTime()) / 60_000
      if (minutesSinceKickoff >= API_MISSING_NTFY_KICKOFF_MINUTES) {
        apiMissingAlerts.push(
          `${fixtureId} (match ${match.id}, kickoff ${Math.floor(minutesSinceKickoff)}m ago, DB status ${match.status_short ?? '?'})`,
        )
      }

      matchesSkipped += 1
      continue
    }

    if (!isSyncableStatus(fixture.fixture.status.short)) {
      matchesSkipped += 1
      continue
    }

    const goals = parseFixtureGoals(fixture)
    if (!goals) {
      matchesSkipped += 1
      continue
    }

    const status = fixture.fixture.status.short.trim().toUpperCase()
    const isFinal = isFinalStatus(fixture.fixture.status.short)
    const isLive = LIVE_MATCH_STATUSES.has(status)

    if (!isFinal && !isLive) {
      matchesSkipped += 1
      continue
    }

    const apiElapsed = fixture.fixture.status.elapsed
    const apiStatusShort = fixture.fixture.status.short

    let effectiveIsFinal = isFinal
    let knockoutAdvancingTeam: number | undefined

    if (isFinal && isKnockoutRound(match.round)) {
      const knockoutFields = knockoutFinalizeFieldsFromFixture(match.round, fixture)
      if (!knockoutFields) {
        effectiveIsFinal = false
        errors.push({
          fixtureId,
          message:
            'Knockout finalize blocked: level score without advancing team',
        })
      } else {
        knockoutAdvancingTeam = knockoutFields.advancing_team
      }
    }

    const scoreOrFinalChanged =
      match.result_team1 !== goals.resultTeam1 ||
      match.result_team2 !== goals.resultTeam2 ||
      match.is_final !== effectiveIsFinal

    const elapsedChanged =
      apiElapsed != null && apiElapsed !== match.elapsed_minute

    const statusChanged = apiStatusShort !== match.status_short

    if (!scoreOrFinalChanged && !elapsedChanged && !statusChanged) {
      matchesSkipped += 1
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
      updatePayload.result_team1 = goals.resultTeam1
      updatePayload.result_team2 = goals.resultTeam2
      updatePayload.is_final = effectiveIsFinal
      if (knockoutAdvancingTeam != null && effectiveIsFinal) {
        updatePayload.advancing_team = knockoutAdvancingTeam
      }
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(updatePayload)
      .eq('id', match.id)

    if (updateError) {
      errors.push({ fixtureId, message: updateError.message })
      continue
    }

    matchesUpdated += 1

    if (scoreOrFinalChanged && effectiveIsFinal) {
      const { error: rpcError } = await supabase.rpc('calculate_match_points', {
        p_match_id: match.id,
      })

      if (rpcError) {
        errors.push({
          fixtureId,
          message: `calculate_match_points: ${rpcError.message}`,
        })
      } else {
        pointsRecalculated += 1
      }
    }
  }

  if (apiMissingAlerts.length > 0) {
    try {
      await sendOpsNtfy(
        `sync-scores: API returned no fixture for ${apiMissingAlerts.length} DB live match(es): ${apiMissingAlerts.join('; ')}`,
      )
    } catch (notifyError) {
      console.error('sync-scores: ops ntfy failed', notifyError)
    }
  }

  return {
    date: todayUtcDateString(),
    matchesChecked: matches.length,
    matchesUpdated,
    matchesSkipped,
    pointsRecalculated,
    apiMissing: apiMissingAlerts.length,
    errors,
  }
}

async function handleSyncRequest(request: Request) {
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
    const summary = await runSync()
    return NextResponse.json({
      success: true,
      ...summary,
    })
  } catch (error) {
    console.error('sync-scores error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleSyncRequest(request)
}

export async function POST(request: Request) {
  return handleSyncRequest(request)
}
