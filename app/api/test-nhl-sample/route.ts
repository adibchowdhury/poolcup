import { NextResponse } from 'next/server'
import {
  isCronAuthorized,
  requireCronSecretConfigured,
} from '@/src/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const API_BASE = 'https://v1.hockey.api-sports.io'

/**
 * Throwaway NHL / hockey shape probe. Delete app/api/test-nhl-sample after use.
 *
 * GET /api/test-nhl-sample
 * Auth: Authorization: Bearer $CRON_SECRET  (or x-cron-secret)
 *
 * Optional: ?league=57&season=2025
 */

type ApiEnvelope = {
  get?: string
  parameters?: Record<string, string>
  errors?: Record<string, string> | string[] | null
  results?: number
  response?: unknown
}

function hasApiErrors(errors: ApiEnvelope['errors']): boolean {
  if (errors == null) return false
  if (Array.isArray(errors)) return errors.length > 0
  return Object.keys(errors).length > 0
}

async function apiGet(
  apiKey: string,
  path: string,
  params?: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: ApiEnvelope; url: string }> {
  const url = new URL(path, `${API_BASE}/`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const body = (await res.json()) as ApiEnvelope
  return { ok: res.ok, status: res.status, body, url: url.toString() }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function leagueName(entry: unknown): string {
  const row = asRecord(entry)
  if (!row) return ''
  const nested = asRecord(row.league)
  const name =
    (typeof nested?.name === 'string' && nested.name) ||
    (typeof row.name === 'string' && row.name) ||
    ''
  return name
}

function leagueId(entry: unknown): number | null {
  const row = asRecord(entry)
  if (!row) return null
  const nested = asRecord(row.league)
  const raw = nested?.id ?? row.id
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

function leagueCountry(entry: unknown): { name: string; code: string } {
  const row = asRecord(entry)
  const country =
    asRecord(row?.country) ??
    asRecord(asRecord(row?.league)?.country) ??
    null
  return {
    name: String(country?.name ?? ''),
    code: String(country?.code ?? '').toUpperCase(),
  }
}

function isNhlLeague(entry: unknown): boolean {
  const name = leagueName(entry).toLowerCase().trim()
  if (!name) return false

  const { name: countryName, code: countryCode } = leagueCountry(entry)
  const countryOk =
    countryCode === 'US' ||
    countryName.toLowerCase() === 'usa' ||
    countryName.toLowerCase().includes('united states') ||
    countryName.toLowerCase().includes('canada') ||
    countryCode === 'CA'

  if (name === 'nhl' || name.includes('national hockey league')) {
    return countryOk || countryName === ''
  }
  if (name.includes('nhl') && countryOk) return true
  return false
}

function describeSeasonValue(value: unknown): string {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{4}$/.test(value)) return 'YYYY-YYYY string'
    if (/^\d{4}$/.test(value)) return 'YYYY string'
    return `string (${value})`
  }
  if (typeof value === 'number' && Number.isFinite(value)) return 'number year'
  return typeof value
}

function extractSeasonKey(s: unknown): string | null {
  if (typeof s === 'string' && s.trim()) return s.trim()
  if (typeof s === 'number' && Number.isFinite(s)) return String(s)
  const obj = asRecord(s)
  if (!obj) return null
  const raw = obj.season ?? obj.year ?? obj.name
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  return null
}

function seasonEndDate(s: unknown): string | null {
  const obj = asRecord(s)
  if (!obj) return null
  const end = obj.end ?? obj.end_date
  return typeof end === 'string' && end.trim() ? end.trim() : null
}

function pickSeasons(entry: unknown): {
  seasons: unknown
  currentSeason: string | null
  completedSeason: string | null
  seasonFormat: string
  seasonKeys: string[]
} {
  const row = asRecord(entry)
  if (!row) {
    return {
      seasons: null,
      currentSeason: null,
      completedSeason: null,
      seasonFormat: 'unknown',
      seasonKeys: [],
    }
  }

  const nested = asRecord(row.league)
  const seasons =
    row.seasons ?? nested?.seasons ?? row.season ?? nested?.season ?? null

  const seasonKeys: string[] = []
  let currentSeason: string | null = null
  let formatHint = 'unknown'
  const today = new Date().toISOString().slice(0, 10)
  const completedCandidates: string[] = []

  if (Array.isArray(seasons)) {
    for (const s of seasons) {
      const key = extractSeasonKey(s)
      if (key) {
        seasonKeys.push(key)
        if (formatHint === 'unknown') formatHint = describeSeasonValue(key)
      }
      const obj = asRecord(s)
      if (obj && (obj.current === true || obj.is_current === true) && key) {
        currentSeason = key
      }
      const end = seasonEndDate(s)
      if (key && end && end < today) completedCandidates.push(key)
    }
    if (!currentSeason && seasonKeys.length > 0) {
      currentSeason = [...seasonKeys].sort().at(-1) ?? null
    }
    if (seasons[0] != null && formatHint === 'unknown') {
      const first = asRecord(seasons[0])
      formatHint = describeSeasonValue(
        first?.season ?? first?.year ?? seasons[0],
      )
    }
  } else if (typeof seasons === 'string' || typeof seasons === 'number') {
    const key = extractSeasonKey(seasons)
    if (key) {
      seasonKeys.push(key)
      currentSeason = key
      formatHint = describeSeasonValue(seasons)
    }
  }

  const sorted = [...seasonKeys].sort()
  let completedSeason: string | null =
    [...completedCandidates].sort().at(-1) ?? null
  if (!completedSeason && sorted.length >= 2) {
    completedSeason = sorted.at(-2) ?? null
  } else if (!completedSeason && currentSeason && sorted.length > 0) {
    completedSeason =
      sorted.filter((k) => k !== currentSeason).sort().at(-1) ?? null
  }

  return {
    seasons,
    currentSeason,
    completedSeason,
    seasonFormat: formatHint,
    seasonKeys,
  }
}

function gameStatusShort(game: unknown): string {
  const g = asRecord(game) ?? {}
  const nested = asRecord(g.game)
  const status = asRecord(g.status) ?? asRecord(nested?.status)
  return String(
    status?.short ?? status?.long ?? g.status ?? nested?.status ?? '',
  ).toUpperCase()
}

function detectShape(game: unknown): {
  idLocation: 'top-level' | 'game.id' | 'unknown'
  scoreKey: 'scores' | 'score' | 'unknown'
  topLevelKeys: string[]
} {
  const g = asRecord(game)
  if (!g) {
    return { idLocation: 'unknown', scoreKey: 'unknown', topLevelKeys: [] }
  }
  const nested = asRecord(g.game)
  const idLocation =
    g.id != null ? 'top-level' : nested?.id != null ? 'game.id' : 'unknown'
  const scoreKey =
    g.scores != null ? 'scores' : g.score != null ? 'score' : 'unknown'
  return { idLocation, scoreKey, topLevelKeys: Object.keys(g) }
}

function summarizeGame(game: unknown): Record<string, unknown> {
  const g = asRecord(game) ?? {}
  const gameObj = asRecord(g.game) ?? null
  const status = asRecord(g.status) ?? asRecord(gameObj?.status) ?? g.status
  const teams = asRecord(g.teams) ?? g.teams
  const scores = asRecord(g.scores) ?? asRecord(g.score) ?? g.scores ?? g.score
  const league = asRecord(g.league) ?? g.league
  const home = asRecord(asRecord(teams)?.home) ?? asRecord(g.home)
  const away = asRecord(asRecord(teams)?.away) ?? asRecord(g.away)
  const scoresRec = asRecord(scores)
  const homeScore =
    asRecord(scoresRec?.home) ?? scoresRec?.home ?? asRecord(g.scores)?.home
  const awayScore =
    asRecord(scoresRec?.away) ?? scoresRec?.away ?? asRecord(g.scores)?.away

  return {
    shape: detectShape(game),
    id: g.id ?? gameObj?.id ?? null,
    date: g.date ?? gameObj?.date ?? null,
    time: g.time ?? gameObj?.time ?? null,
    timestamp: g.timestamp ?? gameObj?.timestamp ?? null,
    timezone: g.timezone ?? gameObj?.timezone ?? null,
    week: g.week ?? gameObj?.week ?? null,
    stage: g.stage ?? gameObj?.stage ?? null,
    venue: g.venue ?? gameObj?.venue ?? null,
    status,
    statusShort:
      asRecord(status)?.short ?? asRecord(status)?.long ?? status ?? null,
    league,
    teams: {
      home: home
        ? { id: home.id, name: home.name, logo: home.logo, raw: home }
        : teams,
      away: away
        ? { id: away.id, name: away.name, logo: away.logo, raw: away }
        : null,
    },
    scores: {
      home: homeScore,
      away: awayScore,
      raw: scores,
      note: 'Inspect periods / overtime / shootout vs total (or scalar home/away)',
    },
    topLevelKeys: Object.keys(g),
  }
}

function statusCounts(games: unknown[]): Record<string, number> {
  const map = new Map<string, number>()
  for (const g of games) {
    const key = gameStatusShort(g) || '(empty)'
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]))
}

function pickSamples(games: unknown[]): unknown[] {
  const classified = games.map((game) => ({
    game,
    short: gameStatusShort(game),
  }))

  const pick = (...preds: ((s: string) => boolean)[]) => {
    for (const pred of preds) {
      const hit = classified.find((c) => pred(c.short))
      if (hit) return hit.game
    }
    return null
  }

  const out: unknown[] = []
  const overtime = pick(
    (s) => s === 'AOT' || s === 'AET' || s.includes('OT') && s !== 'OT',
  )
  const shootout = pick(
    (s) =>
      s === 'AP' ||
      s === 'SO' ||
      s === 'AOT/SO' ||
      s === 'PEN' ||
      s.includes('SHOOT'),
  )
  const finished = pick(
    (s) => s === 'FT' || s === 'FINISHED' || s.includes('FINAL'),
  )
  const live = pick(
    (s) =>
      s.startsWith('P') ||
      s === 'OT' ||
      s === 'HT' ||
      s === 'LIVE' ||
      s === 'BT' ||
      s.includes('PROGRESS'),
  )
  const upcoming = pick(
    (s) =>
      s === 'NS' ||
      s === 'TBD' ||
      s === 'SCHEDULED' ||
      s === 'NOT STARTED' ||
      s === '',
  )

  for (const g of [overtime, shootout, finished, live, upcoming]) {
    if (g && !out.includes(g)) out.push(g)
  }
  for (const g of games) {
    if (out.length >= 3) break
    if (!out.includes(g)) out.push(g)
  }
  return out.slice(0, 3)
}

async function fetchSeasonGames(
  apiKey: string,
  leagueIdNum: number,
  season: string,
  notes: string[],
): Promise<{
  games: unknown[]
  meta: Record<string, unknown>
}> {
  const gamesRes = await apiGet(apiKey, '/games', {
    league: String(leagueIdNum),
    season,
  })

  let games = Array.isArray(gamesRes.body.response)
    ? gamesRes.body.response
    : []

  let meta: Record<string, unknown> = {
    url: gamesRes.url,
    httpStatus: gamesRes.status,
    results: gamesRes.body.results ?? games.length,
    apiErrors: gamesRes.body.errors ?? null,
    parameters: gamesRes.body.parameters ?? null,
  }

  if (games.length === 0) {
    notes.push(
      `No games for league=${leagueIdNum}&season=${season}; trying date probes`,
    )
    const today = new Date()
    const dates = [0, 1, 7].map((daysAgo) => {
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() - daysAgo)
      return d.toISOString().slice(0, 10)
    })

    for (const date of dates) {
      const byDate = await apiGet(apiKey, '/games', {
        league: String(leagueIdNum),
        season,
        date,
      })
      const list = Array.isArray(byDate.body.response)
        ? byDate.body.response
        : []
      notes.push(`date=${date} season=${season} → results=${byDate.body.results ?? list.length}`)
      if (list.length > 0) {
        games = list
        meta = {
          url: byDate.url,
          httpStatus: byDate.status,
          results: byDate.body.results ?? list.length,
          apiErrors: byDate.body.errors ?? null,
          dateProbe: date,
        }
        break
      }
    }
  }

  return { games, meta }
}

export async function GET(request: Request) {
  if (!requireCronSecretConfigured()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API_FOOTBALL_KEY is not configured' },
      { status: 500 },
    )
  }

  const notes: string[] = []
  const forcedSeason = new URL(request.url).searchParams.get('season')?.trim()
  const forcedLeague = new URL(request.url).searchParams.get('league')?.trim()

  try {
    const leaguesRes = await apiGet(apiKey, '/leagues')
    if (!leaguesRes.ok || hasApiErrors(leaguesRes.body.errors)) {
      return NextResponse.json(
        {
          error: 'Failed to fetch /leagues',
          httpStatus: leaguesRes.status,
          apiErrors: leaguesRes.body.errors ?? null,
          url: leaguesRes.url,
        },
        { status: 502 },
      )
    }

    const leagues = Array.isArray(leaguesRes.body.response)
      ? leaguesRes.body.response
      : []

    const nhlCandidates = leagues.filter(isNhlLeague)
    let nhl =
      nhlCandidates.find((e) => leagueName(e).toLowerCase() === 'nhl') ??
      nhlCandidates[0] ??
      null

    if (forcedLeague) {
      const forcedId = Number(forcedLeague)
      const match = leagues.find((e) => leagueId(e) === forcedId) ?? null
      if (match) {
        nhl = match
        notes.push(`Forced league id=${forcedLeague}`)
      } else {
        notes.push(`Forced league id=${forcedLeague} not found in /leagues`)
      }
    }

    if (!nhl) {
      return NextResponse.json({
        note: 'Throwaway NHL shape probe. Delete app/api/test-nhl-sample after use.',
        error: 'NHL league not found in /leagues',
        leagueCount: leagues.length,
        leagueNamesSample: leagues.slice(0, 30).map((e) => ({
          id: leagueId(e),
          name: leagueName(e),
          country: leagueCountry(e),
        })),
        rawFirstLeague: leagues[0] ?? null,
      })
    }

    const {
      seasons,
      currentSeason: detectedSeason,
      completedSeason,
      seasonFormat,
      seasonKeys,
    } = pickSeasons(nhl)

    const season = forcedSeason || detectedSeason || null

    notes.push(
      forcedSeason
        ? `Using season from ?season=${forcedSeason}`
        : detectedSeason
          ? `Using detected/current season ${detectedSeason}`
          : 'Could not detect current season from /leagues',
    )
    notes.push(`Season format observed: ${seasonFormat}`)
    if (completedSeason && completedSeason !== season) {
      notes.push(
        `Also fetching completed season ${completedSeason} for OT/shootout finished-game shape`,
      )
    }

    const leagueIdNum = leagueId(nhl)
    if (leagueIdNum == null) {
      return NextResponse.json(
        { error: 'NHL league entry missing id', nhlLeague: nhl },
        { status: 502 },
      )
    }

    if (!season) {
      return NextResponse.json(
        {
          error: 'Could not resolve NHL season (try ?season=2025)',
          nhlLeague: nhl,
          seasons,
          seasonKeys,
          seasonFormat,
        },
        { status: 502 },
      )
    }

    const primary = await fetchSeasonGames(apiKey, leagueIdNum, season, notes)

    let completed: {
      games: unknown[]
      meta: Record<string, unknown>
    } | null = null
    if (completedSeason && completedSeason !== season) {
      completed = await fetchSeasonGames(
        apiKey,
        leagueIdNum,
        completedSeason,
        notes,
      )
    }

    const sampleSource =
      (completed?.games.length ?? 0) > 0 ? completed!.games : primary.games
    const sampleSeason =
      (completed?.games.length ?? 0) > 0 ? completedSeason : season

    const sampleGames = pickSamples(sampleSource).map((g) => ({
      summarized: summarizeGame(g),
      full: g,
    }))

    const shapeFromSample = sampleGames[0]
      ? detectShape(sampleGames[0].full)
      : null

    return NextResponse.json({
      note: 'Throwaway NHL shape probe. Delete app/api/test-nhl-sample after use.',
      provider: API_BASE,
      notes,
      nhlLeague: {
        id: leagueIdNum,
        name: leagueName(nhl),
        country: leagueCountry(nhl),
        entry: nhl,
        seasons,
        seasonKeys,
        seasonFormat,
        currentSeason: season,
        detectedSeason,
        completedSeason,
      },
      gameShape: {
        observed: shapeFromSample,
        hint: 'Docs show nested game.id + score.home/away scalars; confirm against sampleGames.full',
      },
      primarySeason: {
        season,
        gamesQuery: primary.meta,
        gamesReturned: primary.games.length,
        statusCodeCounts: statusCounts(primary.games),
      },
      completedSeason: completed
        ? {
            season: completedSeason,
            gamesQuery: completed.meta,
            gamesReturned: completed.games.length,
            statusCodeCounts: statusCounts(completed.games),
          }
        : null,
      sampleSeason,
      sampleGames,
      mappingHints: {
        team1: 'teams.home (name, id, logo)',
        team2: 'teams.away (name, id, logo)',
        kickoff_at: 'date / timestamp / timezone (top-level or game.*)',
        result_team1_team2:
          'score vs scores — inspect total / periods / overtime / shootout; does total include OT/SO goal?',
        status_short:
          'status.short — look for FT, AOT, AP, SO, P1–P3, OT, NS (see statusCodeCounts)',
        fixture_id: 'top-level id OR game.id (see gameShape.observed.idLocation)',
        provider_season: `Use exact season value from nhlLeague.currentSeason (format: ${seasonFormat})`,
      },
    })
  } catch (error) {
    console.error('test-nhl-sample error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    )
  }
}
