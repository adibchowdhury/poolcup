/**
 * api-sports.io Basketball client (v1.basketball).
 * Auth: same API_FOOTBALL_KEY via x-apisports-key (All-Sports plan).
 *
 * Game shape is FLAT (top-level id / date / status / teams / scores) — not
 * NFL's nested `game` object. Season is a YYYY-YYYY string (not a year number).
 *
 * /games does NOT support football-style `ids` batches. Live polls must use
 * fetchGamesByDate (league + season + date). fetchGameById uses singular `id`.
 */

const API_BASKETBALL_BASE = 'https://v1.basketball.api-sports.io'

/** Finished game (regulation or overtime). AOT is final, NOT live. */
export const BASKETBALL_FINAL_STATUSES = ['FT', 'AOT'] as const

/**
 * In-progress basketball statuses.
 * Q1–Q4 = quarters; HT = halftime; OT = overtime in progress; LIVE/BT = generic.
 */
export const BASKETBALL_LIVE_STATUSES = new Set([
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'HT',
  'OT',
  'LIVE',
  'BT',
])

const FINAL_STATUS_SET = new Set<string>(BASKETBALL_FINAL_STATUSES)

/** Basketball seasons are "YYYY-YYYY" strings (e.g. 2026-2027). */
const BASKETBALL_SEASON_RE = /^\d{4}-\d{4}$/

export type ApiBasketballTeam = {
  id?: number
  name?: string
  logo?: string | null
}

export type ApiBasketballScoreSide = {
  quarter_1?: number | null
  quarter_2?: number | null
  quarter_3?: number | null
  quarter_4?: number | null
  over_time?: number | null
  total?: number | null
}

/** One game from GET /games (real NBA sample — flat top-level fields). */
export type ApiBasketballGame = {
  id: number
  date?: string
  time?: string
  timestamp?: number
  timezone?: string
  week?: string | null
  stage?: string | null
  venue?: string | null
  status: {
    long?: string
    short?: string
    timer?: string | null
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
    season?: string
  }
  teams: {
    home: ApiBasketballTeam
    away: ApiBasketballTeam
  }
  scores: {
    home: ApiBasketballScoreSide
    away: ApiBasketballScoreSide
  }
}

type ApiBasketballResponse = {
  response?: ApiBasketballGame[]
  errors?: Record<string, string> | string[] | null
  results?: number
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isValidBasketballSeason(
  season: string | null | undefined,
): boolean {
  if (season == null) return false
  return BASKETBALL_SEASON_RE.test(season.trim())
}

export function normalizeBasketballSeason(
  season: string | null | undefined,
): string | null {
  if (!isValidBasketballSeason(season)) return null
  return (season as string).trim()
}

function hasApiErrors(errors: ApiBasketballResponse['errors']): boolean {
  if (errors == null) return false
  if (Array.isArray(errors)) return errors.length > 0
  return Object.keys(errors).length > 0
}

async function fetchApiBasketballGames(
  apiKey: string,
  params: URLSearchParams,
): Promise<ApiBasketballGame[]> {
  const url = `${API_BASKETBALL_BASE}/games?${params.toString()}`

  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const raw = (await res.json()) as ApiBasketballResponse

  if (!res.ok) {
    throw new Error(
      `API-Basketball request failed: ${res.status} ${res.statusText}`,
    )
  }

  if (hasApiErrors(raw.errors)) {
    throw new Error(`API-Basketball error: ${JSON.stringify(raw.errors)}`)
  }

  return raw.response ?? []
}

/** Positive numeric game id (NBA ids are smaller than soccer's 100k floor). */
export function isValidApiBasketballGameId(
  fixtureId: string | null | undefined,
): boolean {
  if (fixtureId == null) return false
  const trimmed = fixtureId.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return false
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) && n > 0
}

export function normalizeBasketballStatusShort(
  statusShort: string | null | undefined,
): string {
  return (statusShort ?? '').trim().toUpperCase()
}

/**
 * Map provider short status into our matches.status_short vocabulary.
 * POST (api-sports postponed) → PST (existing void set).
 */
export function mapBasketballStatusToMatchStatus(
  statusShort: string | null | undefined,
): string | null {
  const raw = normalizeBasketballStatusShort(statusShort)
  if (!raw) return null
  if (raw === 'POST') return 'PST'
  return raw
}

export function isBasketballFinalStatus(
  statusShort: string | null | undefined,
): boolean {
  return FINAL_STATUS_SET.has(normalizeBasketballStatusShort(statusShort))
}

export function isBasketballLiveStatus(
  statusShort: string | null | undefined,
): boolean {
  return BASKETBALL_LIVE_STATUSES.has(
    normalizeBasketballStatusShort(statusShort),
  )
}

export function parseBasketballPoints(
  game: ApiBasketballGame,
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

/** Full-season games for a league. `season` must be the YYYY-YYYY string. */
export async function fetchLeagueSeasonGames(
  apiKey: string,
  leagueId: number,
  season: string,
): Promise<ApiBasketballGame[]> {
  const seasonKey = normalizeBasketballSeason(season)
  if (!seasonKey) {
    throw new Error(`Invalid basketball season: ${season}`)
  }
  const params = new URLSearchParams({
    league: String(leagueId),
    season: seasonKey,
  })
  return fetchApiBasketballGames(apiKey, params)
}

/**
 * Today's (or given UTC date) slate — one request. Use this for live polls.
 * Do NOT send football-style `ids` (basketball /games rejects it).
 */
export async function fetchGamesByDate(
  apiKey: string,
  leagueId: number,
  season: string,
  date: string = todayUtcDateString(),
): Promise<ApiBasketballGame[]> {
  const seasonKey = normalizeBasketballSeason(season)
  if (!seasonKey) {
    throw new Error(`Invalid basketball season: ${season}`)
  }
  const params = new URLSearchParams({
    league: String(leagueId),
    season: seasonKey,
    date,
  })
  return fetchApiBasketballGames(apiKey, params)
}

export async function fetchGameById(
  apiKey: string,
  gameId: string,
): Promise<ApiBasketballGame | null> {
  if (!isValidApiBasketballGameId(gameId)) return null
  const params = new URLSearchParams({ id: gameId })
  const games = await fetchApiBasketballGames(apiKey, params)
  return games[0] ?? null
}
