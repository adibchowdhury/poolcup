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
    status: { short: string; elapsed: number | null }
  }
  goals: {
    home: number | null
    away: number | null
  }
}

type ApiFootballResponse = {
  response: ApiFootballFixture[]
  errors?: Record<string, string>
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10)
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
  const url = buildTodayFixturesUrl(date)

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

export function buildFixtureByIdUrl(fixtureId: string): string {
  const params = new URLSearchParams({ id: fixtureId })
  return `${API_FOOTBALL_BASE}/fixtures?${params.toString()}`
}

export async function fetchFixtureById(
  apiKey: string,
  fixtureId: string,
): Promise<ApiFootballFixture | null> {
  const url = buildFixtureByIdUrl(fixtureId)

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

  const fixtures = raw.response ?? []
  return fixtures[0] ?? null
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
