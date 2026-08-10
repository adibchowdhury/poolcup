import { isValidApiFootballFixtureId } from '@/src/lib/match-updater-guards'

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'

export const LIVE_MATCH_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'P'])

export const FINAL_MATCH_STATUSES = ['FT', 'AET', 'PEN'] as const

const FINAL_MATCH_STATUS_SET = new Set<string>(FINAL_MATCH_STATUSES)

export function isFinalStatus(statusShort: string): boolean {
  return FINAL_MATCH_STATUS_SET.has(statusShort.trim().toUpperCase())
}

export type ApiFootballFixture = {
  fixture: {
    id: number
    date?: string
    status: { short: string; elapsed: number | null }
  }
  league?: {
    id?: number
    round?: string
  }
  goals: {
    home: number | null
    away: number | null
  }
  teams: {
    home: {
      name?: string
      logo?: string | null
      winner: boolean | null
    }
    away: {
      name?: string
      logo?: string | null
      winner: boolean | null
    }
  }
  score: {
    penalty: {
      home: number | null
      away: number | null
    }
  }
}

type ApiFootballResponse = {
  response: ApiFootballFixture[]
  errors?: Record<string, string>
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

async function fetchApiFootballFixtures(
  apiKey: string,
  params: URLSearchParams,
): Promise<ApiFootballFixture[]> {
  const url = `${API_FOOTBALL_BASE}/fixtures?${params.toString()}`

  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const raw = (await res.json()) as ApiFootballResponse

  if (!res.ok) {
    throw new Error(
      `API-Football request failed: ${res.status} ${res.statusText}`,
    )
  }

  if (raw.errors && Object.keys(raw.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(raw.errors)}`)
  }

  return raw.response ?? []
}

export function buildTodayFixturesUrl(date: string): string {
  const params = new URLSearchParams({
    league: '1',
    season: '2026',
    date,
  })
  return `${API_FOOTBALL_BASE}/fixtures?${params.toString()}`
}

export async function fetchTodayFixtures(
  apiKey: string,
  date: string = todayUtcDateString(),
): Promise<ApiFootballFixture[]> {
  const params = new URLSearchParams({
    league: '1',
    season: '2026',
    date,
  })
  return fetchApiFootballFixtures(apiKey, params)
}

/** Full-season fixtures for a league (upcoming + past). */
export async function fetchLeagueSeasonFixtures(
  apiKey: string,
  leagueId: number,
  season: number,
): Promise<ApiFootballFixture[]> {
  const params = new URLSearchParams({
    league: String(leagueId),
    season: String(season),
  })
  return fetchApiFootballFixtures(apiKey, params)
}

export function buildFixtureByIdUrl(fixtureId: string): string {
  const params = new URLSearchParams({ id: fixtureId })
  return `${API_FOOTBALL_BASE}/fixtures?${params.toString()}`
}

export async function fetchFixtureById(
  apiKey: string,
  fixtureId: string,
): Promise<ApiFootballFixture | null> {
  if (!isValidApiFootballFixtureId(fixtureId)) {
    return null
  }

  const fixtures = await fetchFixturesByIds(apiKey, [fixtureId])
  return fixtures[0] ?? null
}

/** API-Football allows up to 20 fixture IDs per `ids` request (dash-separated). */
export const FIXTURE_IDS_BATCH_SIZE = 20

export function buildFixturesByIdsUrl(fixtureIds: string[]): string {
  const params = new URLSearchParams({ ids: fixtureIds.join('-') })
  return `${API_FOOTBALL_BASE}/fixtures?${params.toString()}`
}

async function fetchFixturesByIdsBatch(
  apiKey: string,
  fixtureIds: string[],
): Promise<ApiFootballFixture[]> {
  if (fixtureIds.length === 0) return []

  const params = new URLSearchParams({ ids: fixtureIds.join('-') })
  return fetchApiFootballFixtures(apiKey, params)
}

export async function fetchFixturesByIds(
  apiKey: string,
  fixtureIds: string[],
): Promise<ApiFootballFixture[]> {
  if (fixtureIds.length === 0) return []

  const uniqueIds = [
    ...new Set(fixtureIds.filter((id) => isValidApiFootballFixtureId(id))),
  ]
  if (uniqueIds.length === 0) return []

  const fixtures: ApiFootballFixture[] = []

  for (let i = 0; i < uniqueIds.length; i += FIXTURE_IDS_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + FIXTURE_IDS_BATCH_SIZE)
    const batchFixtures = await fetchFixturesByIdsBatch(apiKey, batch)
    fixtures.push(...batchFixtures)
  }

  return fixtures
}

/** Prefer API goals; fall back to stored DB scores. Never invent a score. */
export function resolveFixtureScoresForForceClose(
  fixture: ApiFootballFixture,
  storedTeam1: number | null,
  storedTeam2: number | null,
): { resultTeam1: number; resultTeam2: number } | null {
  const apiGoals = parseFixtureGoals(fixture)
  if (apiGoals) return apiGoals

  if (storedTeam1 != null && storedTeam2 != null) {
    return { resultTeam1: storedTeam1, resultTeam2: storedTeam2 }
  }

  return null
}

export type MatchUpdateFromFixture = {
  result_team1: number
  result_team2: number
  status_short: string
  elapsed_minute: number | null
  is_final: boolean
}

export function deriveMatchUpdateFromFixture(
  fixture: ApiFootballFixture,
): MatchUpdateFromFixture | null {
  const goals = parseFixtureGoals(fixture)
  if (!goals) return null

  const statusShort = fixture.fixture.status.short.trim()
  const status = statusShort.toUpperCase()

  if (status === 'NS' || status === '') return null

  if (isFinalStatus(statusShort)) {
    return {
      result_team1: goals.resultTeam1,
      result_team2: goals.resultTeam2,
      status_short: fixture.fixture.status.short,
      elapsed_minute: fixture.fixture.status.elapsed,
      is_final: true,
    }
  }

  if (LIVE_MATCH_STATUSES.has(status)) {
    return {
      result_team1: goals.resultTeam1,
      result_team2: goals.resultTeam2,
      status_short: fixture.fixture.status.short,
      elapsed_minute: fixture.fixture.status.elapsed,
      is_final: false,
    }
  }

  return null
}

export function isSyncableStatus(statusShort: string): boolean {
  const status = statusShort.trim().toUpperCase()
  return isFinalStatus(status) || LIVE_MATCH_STATUSES.has(status)
}

export function parseFixtureGoals(
  fixture: ApiFootballFixture,
): { resultTeam1: number; resultTeam2: number } | null {
  const { home, away } = fixture.goals
  if (home == null || away == null) return null
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return null
  }
  return { resultTeam1: home, resultTeam2: away }
}

/**
 * Who advances in a knockout match. Team 1 = home (goals.home), team 2 = away.
 * resultTeam1/resultTeam2 follow parseFixtureGoals: home → 1, away → 2.
 */
export function parseAdvancingTeam(fixture: ApiFootballFixture): 1 | 2 | null {
  const goals = parseFixtureGoals(fixture)
  if (!goals) return null

  const { resultTeam1, resultTeam2 } = goals
  if (resultTeam1 > resultTeam2) return 1
  if (resultTeam2 > resultTeam1) return 2

  if (fixture.teams.home.winner === true) return 1
  if (fixture.teams.away.winner === true) return 2

  const penHome = fixture.score.penalty.home
  const penAway = fixture.score.penalty.away
  if (
    penHome != null &&
    penAway != null &&
    Number.isInteger(penHome) &&
    Number.isInteger(penAway) &&
    penHome >= 0 &&
    penAway >= 0
  ) {
    if (penHome > penAway) return 1
    if (penAway > penHome) return 2
  }

  return null
}
