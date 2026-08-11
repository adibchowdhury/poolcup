/**
 * api-sports.io Baseball client (v1.baseball).
 * Auth: same API_FOOTBALL_KEY via x-apisports-key (All-Sports plan).
 */

const API_BASEBALL_BASE = 'https://v1.baseball.api-sports.io'

/** Finished game. */
export const BASEBALL_FINAL_STATUSES = ['FT'] as const

/**
 * In-progress baseball statuses from api-sports baseball.
 * IN1–IN9 = innings; IN0 = extra innings; LIVE/BT = generic live / break.
 */
export const BASEBALL_LIVE_STATUSES = new Set([
  'IN0',
  'IN1',
  'IN2',
  'IN3',
  'IN4',
  'IN5',
  'IN6',
  'IN7',
  'IN8',
  'IN9',
  'LIVE',
  'BT',
])

const FINAL_STATUS_SET = new Set<string>(BASEBALL_FINAL_STATUSES)

export type ApiBaseballTeam = {
  id?: number
  name?: string
  logo?: string | null
}

export type ApiBaseballScoreSide = {
  hits?: number | null
  errors?: number | null
  innings?: Record<string, number | null> | null
  total?: number | null
}

/** One game from GET /games (real MLB sample shape). */
export type ApiBaseballGame = {
  id: number
  date?: string
  time?: string
  timestamp?: number
  timezone?: string
  week?: string | null
  status: {
    long?: string
    short?: string
  }
  country?: {
    id?: number
    name?: string
    code?: string
    flag?: string | null
  }
  league?: {
    id?: number
    name?: string
    type?: string
    logo?: string | null
    season?: number
  }
  teams: {
    home: ApiBaseballTeam
    away: ApiBaseballTeam
  }
  scores: {
    home: ApiBaseballScoreSide
    away: ApiBaseballScoreSide
  }
}

type ApiBaseballResponse = {
  response?: ApiBaseballGame[]
  errors?: Record<string, string> | string[] | null
  results?: number
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function hasApiErrors(errors: ApiBaseballResponse['errors']): boolean {
  if (errors == null) return false
  if (Array.isArray(errors)) return errors.length > 0
  return Object.keys(errors).length > 0
}

async function fetchApiBaseballGames(
  apiKey: string,
  params: URLSearchParams,
): Promise<ApiBaseballGame[]> {
  const url = `${API_BASEBALL_BASE}/games?${params.toString()}`

  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const raw = (await res.json()) as ApiBaseballResponse

  if (!res.ok) {
    throw new Error(
      `API-Baseball request failed: ${res.status} ${res.statusText}`,
    )
  }

  if (hasApiErrors(raw.errors)) {
    throw new Error(`API-Baseball error: ${JSON.stringify(raw.errors)}`)
  }

  return raw.response ?? []
}

/** Positive numeric game id (baseball ids are smaller than soccer's 100k floor). */
export function isValidApiBaseballGameId(
  fixtureId: string | null | undefined,
): boolean {
  if (fixtureId == null) return false
  const trimmed = fixtureId.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return false
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) && n > 0
}

export function normalizeBaseballStatusShort(
  statusShort: string | null | undefined,
): string {
  return (statusShort ?? '').trim().toUpperCase()
}

/**
 * Map provider short status into our matches.status_short vocabulary.
 * POST (api-sports baseball postponed) → PST (existing void set).
 */
export function mapBaseballStatusToMatchStatus(
  statusShort: string | null | undefined,
): string | null {
  const raw = normalizeBaseballStatusShort(statusShort)
  if (!raw) return null
  if (raw === 'POST') return 'PST'
  return raw
}

export function isBaseballFinalStatus(statusShort: string | null | undefined): boolean {
  return FINAL_STATUS_SET.has(normalizeBaseballStatusShort(statusShort))
}

export function isBaseballLiveStatus(statusShort: string | null | undefined): boolean {
  return BASEBALL_LIVE_STATUSES.has(normalizeBaseballStatusShort(statusShort))
}

export function parseBaseballRuns(
  game: ApiBaseballGame,
): { resultTeam1: number; resultTeam2: number } | null {
  const home = game.scores?.home?.total
  const away = game.scores?.away?.total
  if (home == null || away == null) return null
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return null
  }
  // team1 = home, team2 = away
  return { resultTeam1: home, resultTeam2: away }
}

/** Full-season games for a league (upcoming + past). */
export async function fetchLeagueSeasonGames(
  apiKey: string,
  leagueId: number,
  season: number,
): Promise<ApiBaseballGame[]> {
  const params = new URLSearchParams({
    league: String(leagueId),
    season: String(season),
  })
  return fetchApiBaseballGames(apiKey, params)
}

export async function fetchGamesByDate(
  apiKey: string,
  leagueId: number,
  season: number,
  date: string = todayUtcDateString(),
): Promise<ApiBaseballGame[]> {
  const params = new URLSearchParams({
    league: String(leagueId),
    season: String(season),
    date,
  })
  return fetchApiBaseballGames(apiKey, params)
}

/**
 * Baseball /games does NOT support football-style `ids` batches.
 * Use singular `id` per request (or prefer fetchGamesByDate for live polls).
 */
export async function fetchGamesByIds(
  apiKey: string,
  gameIds: string[],
): Promise<ApiBaseballGame[]> {
  if (gameIds.length === 0) return []

  const uniqueIds = [
    ...new Set(gameIds.filter((id) => isValidApiBaseballGameId(id))),
  ]
  if (uniqueIds.length === 0) return []

  const games: ApiBaseballGame[] = []
  for (const id of uniqueIds) {
    const params = new URLSearchParams({ id })
    const batchGames = await fetchApiBaseballGames(apiKey, params)
    games.push(...batchGames)
  }
  return games
}

export async function fetchGameById(
  apiKey: string,
  gameId: string,
): Promise<ApiBaseballGame | null> {
  if (!isValidApiBaseballGameId(gameId)) return null
  const params = new URLSearchParams({ id: gameId })
  const games = await fetchApiBaseballGames(apiKey, params)
  return games[0] ?? null
}
