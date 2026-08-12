/**
 * api-sports.io Hockey client (v1.hockey).
 * Auth: same API_FOOTBALL_KEY via x-apisports-key (All-Sports plan).
 *
 * Game shape is FLAT (top-level id / date / status / teams / scores) — like
 * basketball, not NFL's nested `game` object. Season is a 4-digit year
 * ("2026"), not basketball's YYYY-YYYY string.
 *
 * scores.home / scores.away are SCALAR goal totals (already include OT /
 * shootout winning goals). Use them as-is for result_team1/2.
 *
 * /games does NOT support football-style `ids` batches. Live polls must use
 * fetchGamesByDate (league + season + date). fetchGameById uses singular `id`.
 */

const API_HOCKEY_BASE = 'https://v1.hockey.api-sports.io'

/**
 * Finished game: regulation, overtime, or shootout (after penalties).
 * AOT and AP are final, NOT live.
 */
export const HOCKEY_FINAL_STATUSES = ['FT', 'AOT', 'AP'] as const

/**
 * In-progress hockey statuses.
 * P1–P3 = periods; OT = overtime in progress; LIVE/BT = generic.
 */
export const HOCKEY_LIVE_STATUSES = new Set([
  'P1',
  'P2',
  'P3',
  'OT',
  'LIVE',
  'BT',
])

const FINAL_STATUS_SET = new Set<string>(HOCKEY_FINAL_STATUSES)

/** Hockey seasons are 4-digit years (e.g. 2026). */
const HOCKEY_SEASON_RE = /^\d{4}$/

export type ApiHockeyTeam = {
  id?: number
  name?: string
  logo?: string | null
}

/** Real NHL sample: scores.home / scores.away are integers, not objects. */
export type ApiHockeyScores = {
  home?: number | null
  away?: number | null
}

export type ApiHockeyPeriods = {
  first?: string | null
  second?: string | null
  third?: string | null
  overtime?: string | null
  penalties?: string | null
}

/** One game from GET /games (real NHL sample — flat top-level fields). */
export type ApiHockeyGame = {
  id: number
  date?: string
  time?: string
  timestamp?: number
  timezone?: string
  week?: string | null
  timer?: string | null
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
    season?: number | string
  }
  teams: {
    home: ApiHockeyTeam
    away: ApiHockeyTeam
  }
  scores: ApiHockeyScores
  periods?: ApiHockeyPeriods
  events?: boolean
}

type ApiHockeyResponse = {
  response?: ApiHockeyGame[]
  errors?: Record<string, string> | string[] | null
  results?: number
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isValidHockeySeason(
  season: string | null | undefined,
): boolean {
  if (season == null) return false
  const trimmed = season.trim()
  if (!HOCKEY_SEASON_RE.test(trimmed)) return false
  const year = Number.parseInt(trimmed, 10)
  return Number.isFinite(year) && year >= 2000 && year <= 2100
}

export function normalizeHockeySeason(
  season: string | null | undefined,
): string | null {
  if (!isValidHockeySeason(season)) return null
  return (season as string).trim()
}

function hasApiErrors(errors: ApiHockeyResponse['errors']): boolean {
  if (errors == null) return false
  if (Array.isArray(errors)) return errors.length > 0
  return Object.keys(errors).length > 0
}

async function fetchApiHockeyGames(
  apiKey: string,
  params: URLSearchParams,
): Promise<ApiHockeyGame[]> {
  const url = `${API_HOCKEY_BASE}/games?${params.toString()}`

  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const raw = (await res.json()) as ApiHockeyResponse

  if (!res.ok) {
    throw new Error(
      `API-Hockey request failed: ${res.status} ${res.statusText}`,
    )
  }

  if (hasApiErrors(raw.errors)) {
    throw new Error(`API-Hockey error: ${JSON.stringify(raw.errors)}`)
  }

  return raw.response ?? []
}

/** Positive numeric game id (NHL ids are smaller than soccer's 100k floor). */
export function isValidApiHockeyGameId(
  fixtureId: string | null | undefined,
): boolean {
  if (fixtureId == null) return false
  const trimmed = fixtureId.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return false
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) && n > 0
}

export function normalizeHockeyStatusShort(
  statusShort: string | null | undefined,
): string {
  return (statusShort ?? '').trim().toUpperCase()
}

/**
 * Map provider short status into our matches.status_short vocabulary.
 * POST (api-sports postponed) → PST (existing void set).
 */
export function mapHockeyStatusToMatchStatus(
  statusShort: string | null | undefined,
): string | null {
  const raw = normalizeHockeyStatusShort(statusShort)
  if (!raw) return null
  if (raw === 'POST') return 'PST'
  return raw
}

export function isHockeyFinalStatus(
  statusShort: string | null | undefined,
): boolean {
  return FINAL_STATUS_SET.has(normalizeHockeyStatusShort(statusShort))
}

export function isHockeyLiveStatus(
  statusShort: string | null | undefined,
): boolean {
  return HOCKEY_LIVE_STATUSES.has(normalizeHockeyStatusShort(statusShort))
}

/**
 * Final goal totals. Scalars already include OT / shootout winning goals.
 */
export function parseHockeyGoals(
  game: ApiHockeyGame,
): { resultTeam1: number; resultTeam2: number } | null {
  const home = game.scores?.home
  const away = game.scores?.away
  if (home == null || away == null) return null
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return null
  }
  // team1 = home, team2 = away
  return { resultTeam1: home, resultTeam2: away }
}

/** Full-season games for a league. `season` must be the 4-digit year. */
export async function fetchLeagueSeasonGames(
  apiKey: string,
  leagueId: number,
  season: string,
): Promise<ApiHockeyGame[]> {
  const seasonKey = normalizeHockeySeason(season)
  if (!seasonKey) {
    throw new Error(`Invalid hockey season: ${season}`)
  }
  const params = new URLSearchParams({
    league: String(leagueId),
    season: seasonKey,
  })
  return fetchApiHockeyGames(apiKey, params)
}

/**
 * Today's (or given UTC date) slate — one request. Use this for live polls.
 * Do NOT send football-style `ids`.
 */
export async function fetchGamesByDate(
  apiKey: string,
  leagueId: number,
  season: string,
  date: string = todayUtcDateString(),
): Promise<ApiHockeyGame[]> {
  const seasonKey = normalizeHockeySeason(season)
  if (!seasonKey) {
    throw new Error(`Invalid hockey season: ${season}`)
  }
  const params = new URLSearchParams({
    league: String(leagueId),
    season: seasonKey,
    date,
  })
  return fetchApiHockeyGames(apiKey, params)
}

export async function fetchGameById(
  apiKey: string,
  gameId: string,
): Promise<ApiHockeyGame | null> {
  if (!isValidApiHockeyGameId(gameId)) return null
  const params = new URLSearchParams({ id: gameId })
  const games = await fetchApiHockeyGames(apiKey, params)
  return games[0] ?? null
}
