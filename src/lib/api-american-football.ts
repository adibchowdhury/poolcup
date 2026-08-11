/**
 * api-sports.io American Football client (v1.american-football).
 * Auth: same API_FOOTBALL_KEY via x-apisports-key (All-Sports plan).
 *
 * Real NFL game shape nests identity under `game` (id, date, status, stage, week)
 * with top-level `teams` / `scores` / `league`.
 */

const API_AMERICAN_FOOTBALL_BASE =
  'https://v1.american-football.api-sports.io'

/** Finished game. */
export const AMERICAN_FOOTBALL_FINAL_STATUSES = ['FT', 'AOT'] as const

/**
 * In-progress american-football statuses (NFL).
 * Quarters, half, OT, plus generic live / break.
 */
export const AMERICAN_FOOTBALL_LIVE_STATUSES = new Set([
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'OT',
  'HT',
  'LIVE',
  'BT',
])

const FINAL_STATUS_SET = new Set<string>(AMERICAN_FOOTBALL_FINAL_STATUSES)

export type ApiAmericanFootballTeam = {
  id?: number
  name?: string
  logo?: string | null
}

export type ApiAmericanFootballScoreSide = {
  quarter_1?: number | null
  quarter_2?: number | null
  quarter_3?: number | null
  quarter_4?: number | null
  overtime?: number | null
  total?: number | null
}

export type ApiAmericanFootballGameDate = {
  date?: string
  time?: string
  timestamp?: number
  timezone?: string
}

export type ApiAmericanFootballGameInner = {
  id?: number
  stage?: string | null
  week?: string | null
  date?: ApiAmericanFootballGameDate | string
  status?: {
    long?: string
    short?: string
    timer?: string | null
  }
  venue?: {
    name?: string | null
    city?: string | null
  } | null
}

/** One game from GET /games (NFL sample shape). */
export type ApiAmericanFootballGame = {
  /** Some payloads flatten id at top level; NFL nests under game.id. */
  id?: number
  game?: ApiAmericanFootballGameInner
  date?: ApiAmericanFootballGameDate | string
  time?: string
  timestamp?: number
  timezone?: string
  week?: string | null
  stage?: string | null
  status?: {
    long?: string
    short?: string
    timer?: string | null
  }
  league?: {
    id?: number
    name?: string
    season?: number | string
    logo?: string | null
    country?: {
      name?: string
      code?: string
      flag?: string | null
    }
  }
  teams: {
    home: ApiAmericanFootballTeam
    away: ApiAmericanFootballTeam
  }
  scores: {
    home: ApiAmericanFootballScoreSide
    away: ApiAmericanFootballScoreSide
  }
}

type ApiAmericanFootballResponse = {
  response?: ApiAmericanFootballGame[]
  errors?: Record<string, string> | string[] | null
  results?: number
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function hasApiErrors(errors: ApiAmericanFootballResponse['errors']): boolean {
  if (errors == null) return false
  if (Array.isArray(errors)) return errors.length > 0
  return Object.keys(errors).length > 0
}

async function fetchApiAmericanFootballGames(
  apiKey: string,
  params: URLSearchParams,
): Promise<ApiAmericanFootballGame[]> {
  const url = `${API_AMERICAN_FOOTBALL_BASE}/games?${params.toString()}`

  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const raw = (await res.json()) as ApiAmericanFootballResponse

  if (!res.ok) {
    throw new Error(
      `API-American-Football request failed: ${res.status} ${res.statusText}`,
    )
  }

  if (hasApiErrors(raw.errors)) {
    throw new Error(
      `API-American-Football error: ${JSON.stringify(raw.errors)}`,
    )
  }

  return raw.response ?? []
}

/** Extract provider game id (nested game.id or top-level id). */
export function getAmericanFootballGameId(
  game: ApiAmericanFootballGame,
): number | null {
  const raw = game.game?.id ?? game.id
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function isValidApiAmericanFootballGameId(
  fixtureId: string | null | undefined,
): boolean {
  if (fixtureId == null) return false
  const trimmed = fixtureId.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return false
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) && n > 0
}

export function normalizeAmericanFootballStatusShort(
  statusShort: string | null | undefined,
): string {
  return (statusShort ?? '').trim().toUpperCase()
}

export function getAmericanFootballStatusShort(
  game: ApiAmericanFootballGame,
): string | null {
  const raw = game.game?.status?.short ?? game.status?.short
  if (!raw) return null
  return normalizeAmericanFootballStatusShort(raw)
}

/**
 * Map provider short status into matches.status_short vocabulary.
 * POST (postponed) → PST (existing void set).
 */
export function mapAmericanFootballStatusToMatchStatus(
  statusShort: string | null | undefined,
): string | null {
  const raw = normalizeAmericanFootballStatusShort(statusShort)
  if (!raw) return null
  if (raw === 'POST') return 'PST'
  return raw
}

export function isAmericanFootballFinalStatus(
  statusShort: string | null | undefined,
): boolean {
  return FINAL_STATUS_SET.has(normalizeAmericanFootballStatusShort(statusShort))
}

export function isAmericanFootballLiveStatus(
  statusShort: string | null | undefined,
): boolean {
  return AMERICAN_FOOTBALL_LIVE_STATUSES.has(
    normalizeAmericanFootballStatusShort(statusShort),
  )
}

export function parseAmericanFootballPoints(
  game: ApiAmericanFootballGame,
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

/**
 * Normalize API stage → matches.round.
 * Ingests all stages: preseason / regular / playoff.
 */
export function mapAmericanFootballStageToRound(
  stage: string | null | undefined,
): 'preseason' | 'regular' | 'playoff' {
  const raw = (stage ?? '').trim().toLowerCase()
  if (!raw) return 'regular'
  if (raw.includes('pre')) return 'preseason'
  if (
    raw.includes('post') ||
    raw.includes('playoff') ||
    raw.includes('super bowl') ||
    raw.includes('wildcard') ||
    raw.includes('wild card')
  ) {
    return 'playoff'
  }
  return 'regular'
}

export function getAmericanFootballStage(
  game: ApiAmericanFootballGame,
): string | null {
  const stage = game.game?.stage ?? game.stage
  return typeof stage === 'string' && stage.trim() ? stage.trim() : null
}

/**
 * Kickoff UTC ISO from nested date.timestamp, date.date+time, or flat fields.
 */
export function getAmericanFootballKickoffIso(
  game: ApiAmericanFootballGame,
): string | null {
  const nested = game.game?.date
  const dateObj =
    nested && typeof nested === 'object' ? nested : null
  const flatDateObj =
    game.date && typeof game.date === 'object' ? game.date : null

  const timestamp =
    dateObj?.timestamp ??
    flatDateObj?.timestamp ??
    game.timestamp ??
    null

  if (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0) {
    // API uses unix seconds.
    const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp
    return new Date(ms).toISOString()
  }

  const dateStr =
    (typeof nested === 'string' && nested.trim()) ||
    dateObj?.date?.trim() ||
    (typeof game.date === 'string' && game.date.trim()) ||
    flatDateObj?.date?.trim() ||
    null

  if (!dateStr) return null

  const timeStr =
    dateObj?.time?.trim() ||
    flatDateObj?.time?.trim() ||
    game.time?.trim() ||
    null

  const combined =
    timeStr && !dateStr.includes('T')
      ? `${dateStr}T${timeStr}`
      : dateStr

  // Prefer explicit Z / offset; otherwise treat as UTC.
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(combined)
  const toParse = hasZone
    ? combined
    : combined.includes('T')
      ? `${combined}Z`
      : `${combined}T00:00:00Z`

  const ms = Date.parse(toParse)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

/** Full-season games for a league (upcoming + past; all stages). */
export async function fetchLeagueSeasonGames(
  apiKey: string,
  leagueId: number,
  season: number,
): Promise<ApiAmericanFootballGame[]> {
  const params = new URLSearchParams({
    league: String(leagueId),
    season: String(season),
  })
  return fetchApiAmericanFootballGames(apiKey, params)
}

export async function fetchGamesByDate(
  apiKey: string,
  leagueId: number,
  season: number,
  date: string = todayUtcDateString(),
): Promise<ApiAmericanFootballGame[]> {
  const params = new URLSearchParams({
    league: String(leagueId),
    season: String(season),
    date,
  })
  return fetchApiAmericanFootballGames(apiKey, params)
}

/**
 * American-football /games does NOT support football-style `ids` batches.
 * Use singular `id` per request (or prefer fetchGamesByDate for live polls).
 */
export async function fetchGamesByIds(
  apiKey: string,
  gameIds: string[],
): Promise<ApiAmericanFootballGame[]> {
  if (gameIds.length === 0) return []

  const uniqueIds = [
    ...new Set(gameIds.filter((id) => isValidApiAmericanFootballGameId(id))),
  ]
  if (uniqueIds.length === 0) return []

  const games: ApiAmericanFootballGame[] = []
  for (const id of uniqueIds) {
    const params = new URLSearchParams({ id })
    const batchGames = await fetchApiAmericanFootballGames(apiKey, params)
    games.push(...batchGames)
  }
  return games
}

export async function fetchGameById(
  apiKey: string,
  gameId: string,
): Promise<ApiAmericanFootballGame | null> {
  if (!isValidApiAmericanFootballGameId(gameId)) return null
  const params = new URLSearchParams({ id: gameId })
  const games = await fetchApiAmericanFootballGames(apiKey, params)
  return games[0] ?? null
}
