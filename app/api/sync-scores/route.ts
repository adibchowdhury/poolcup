import { NextResponse } from 'next/server'
import {
  fetchTodayFixtures,
  FINAL_MATCH_STATUS,
  isSyncableStatus,
  LIVE_MATCH_STATUSES,
  parseFixtureGoals,
  todayUtcDateString,
} from '@/src/lib/api-football'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

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

function isAuthorized(request: Request, bodySecret?: string): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  if (bodySecret && bodySecret === cronSecret) return true

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) return true

  const cronHeader = request.headers.get('x-cron-secret')
  if (cronHeader === cronSecret) return true

  return false
}

async function runSync(): Promise<{
  date: string
  matchesChecked: number
  matchesUpdated: number
  matchesSkipped: number
  pointsRecalculated: number
  errors: SyncError[]
}> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured')
  }

  const date = todayUtcDateString()
  const fixtures = await fetchTodayFixtures(apiKey, date)
  const supabase = createAdminSupabaseClient()

  const syncableFixtures = fixtures.filter((fixture) =>
    isSyncableStatus(fixture.fixture.status.short),
  )

  if (syncableFixtures.length === 0) {
    console.log(
      `sync-scores: date=${date} checked=0 updated=0 (no live/FT fixtures from API)`,
    )
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
    const isFinal = status === FINAL_MATCH_STATUS
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

  console.log(
    `sync-scores: date=${date} checked=${matchesChecked} updated=${matchesUpdated} skipped=${matchesSkipped} pointsRecalculated=${pointsRecalculated} errors=${errors.length}`,
  )

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

  let bodySecret: string | undefined
  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as { apiSecret?: string }
      bodySecret = body.apiSecret
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  }

  if (!isAuthorized(request, bodySecret)) {
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
