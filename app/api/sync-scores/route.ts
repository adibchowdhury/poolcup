import { NextResponse } from 'next/server'
import {
  fetchTodayFixtures,
  isFinalStatus,
  isSyncableStatus,
  LIVE_MATCH_STATUSES,
  parseFixtureGoals,
  todayUtcDateString,
} from '@/src/lib/api-football'
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
  result_team1: number | null
  result_team2: number | null
  is_final: boolean
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

const LIVE_WINDOW_MAX_AGE_MINUTES = 210
const LIVE_WINDOW_PRE_KICKOFF_MINUTES = 5

async function runSync(): Promise<{
  date: string
  matchesChecked: number
  matchesUpdated: number
  matchesSkipped: number
  pointsRecalculated: number
  errors: SyncError[]
  skipped?: string
}> {
  const supabase = createAdminSupabaseClient()
  const nowMs = Date.now()
  const windowStart = new Date(
    nowMs - LIVE_WINDOW_MAX_AGE_MINUTES * 60_000,
  ).toISOString()
  const windowEnd = new Date(
    nowMs + LIVE_WINDOW_PRE_KICKOFF_MINUTES * 60_000,
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
      errors: [],
      skipped: 'no_live_window',
    }
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured')
  }

  const date = todayUtcDateString()
  const fixtures = await fetchTodayFixtures(apiKey, date)

  const syncableFixtures = fixtures.filter((fixture) =>
    isSyncableStatus(fixture.fixture.status.short),
  )

  if (syncableFixtures.length === 0) {
    return {
      date,
      matchesChecked: 0,
      matchesUpdated: 0,
      matchesSkipped: 0,
      pointsRecalculated: 0,
      errors: [],
    }
  }

  const fixtureIds = syncableFixtures.map((f) => String(f.fixture.id))

  const { data: matchRows, error: loadError } = await supabase
    .from('matches')
    .select('id, fixture_id, result_team1, result_team2, is_final')
    .in('fixture_id', fixtureIds)

  if (loadError) {
    throw new Error(`Failed to load matches: ${loadError.message}`)
  }

  const matchByFixtureId = new Map<string, MatchRow>()
  for (const row of (matchRows ?? []) as MatchRow[]) {
    matchByFixtureId.set(row.fixture_id, row)
  }

  let matchesUpdated = 0
  let matchesSkipped = 0
  let pointsRecalculated = 0
  const errors: SyncError[] = []

  for (const fixture of syncableFixtures) {
    const fixtureId = String(fixture.fixture.id)
    const match = matchByFixtureId.get(fixtureId)

    if (!match) {
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

    const unchanged =
      match.result_team1 === goals.resultTeam1 &&
      match.result_team2 === goals.resultTeam2 &&
      match.is_final === isFinal

    if (unchanged) {
      matchesSkipped += 1
      continue
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({
        result_team1: goals.resultTeam1,
        result_team2: goals.resultTeam2,
        is_final: isFinal,
        status_short: fixture.fixture.status.short,
        elapsed_minute: fixture.fixture.status.elapsed,
      })
      .eq('id', match.id)

    if (updateError) {
      errors.push({ fixtureId, message: updateError.message })
      continue
    }

    matchesUpdated += 1

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

  const matchesChecked = syncableFixtures.length

  return {
    date,
    matchesChecked,
    matchesUpdated,
    matchesSkipped,
    pointsRecalculated,
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
