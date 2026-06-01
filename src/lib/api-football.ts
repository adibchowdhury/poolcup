const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'

export const LIVE_MATCH_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'P'])

export const FINAL_MATCH_STATUS = 'FT'

export type ApiFootballFixture = {
  fixture: {
    id: number
    status: { short: string }
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

export function isSyncableStatus(statusShort: string): boolean {
  const status = statusShort.trim().toUpperCase()
  return status === FINAL_MATCH_STATUS || LIVE_MATCH_STATUSES.has(status)
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
