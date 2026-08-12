import { NextResponse } from 'next/server'
import {
  isCronAuthorized,
  requireCronSecretConfigured,
} from '@/src/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const API_BASE = 'https://v1.basketball.api-sports.io'

/**
 * Throwaway NBA / basketball shape probe. Delete app/api/test-nba-sample after use.
 *
 * GET /api/test-nba-sample
 * Auth: Authorization: Bearer $CRON_SECRET  (or x-cron-secret)
 *
 * Optional: ?league=12&season=2025-2026
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

function isNbaLeague(entry: unknown): boolean {
  const name = leagueName(entry).toLowerCase().trim()
  if (!name) return false

  const { name: countryName, code: countryCode } = leagueCountry(entry)
  const countryOk =
    countryCode === 'US' ||
    countryName.toLowerCase() === 'usa' ||
    countryName.toLowerCase().includes('united states')

  if (name === 'nba' || name.includes('national basketball association')) {
    return countryOk || countryName === ''
  }
  if (name.includes('nba') && countryOk) return true
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

function pickSeasons(entry: unknown): {
  seasons: unknown
  currentSeason: string | null
  seasonFormat: string
  seasonKeys: string[]
} {
  const row = asRecord(entry)
  if (!row) {
    return {
      seasons: null,
      currentSeason: null,
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

  return { seasons, currentSeason, seasonFormat: formatHint, seasonKeys }
}

function summarizeGame(game: unknown): Record<string, unknown> {
  const g = asRecord(game) ?? {}
  const status = asRecord(g.status) ?? g.status
  const teams = asRecord(g.teams) ?? g.teams
  const scores = asRecord(g.scores) ?? g.scores
  const league = asRecord(g.league) ?? g.league
  const gameObj = asRecord(g.game) ?? null
  const home = asRecord(asRecord(teams)?.home) ?? asRecord(g.home)
  const away = asRecord(asRecord(teams)?.away) ?? asRecord(g.away)
  const homeScore = asRecord(asRecord(scores)?.home) ?? asRecord(scores)?.home
  const awayScore = asRecord(asRecord(scores)?.away) ?? asRecord(scores)?.away

  return {
    id: g.id ?? gameObj?.id ?? null,
    date: g.date ?? gameObj?.date ?? null,
    time: g.time ?? gameObj?.time ?? null,
    timestamp: g.timestamp ?? gameObj?.timestamp ?? null,
    timezone: g.timezone ?? gameObj?.timezone ?? null,
    week: g.week ?? null,
    stage: g.stage ?? null,
    venue: g.venue ?? null,
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
    },
    topLevelKeys: Object.keys(g),
  }
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

    const nbaCandidates = leagues.filter(isNbaLeague)
    let nba =
      nbaCandidates.find((e) => leagueName(e).toLowerCase() === 'nba') ??
      nbaCandidates[0] ??
      null

    if (forcedLeague) {
      const forcedId = Number(forcedLeague)
      const match = leagues.find((e) => leagueId(e) === forcedId) ?? null
      if (match) {
        nba = match
        notes.push(`Forced league id=${forcedLeague}`)
      } else {
        notes.push(`Forced league id=${forcedLeague} not found in /leagues`)
      }
    }

    if (!nba) {
      return NextResponse.json({
        note: 'Throwaway NBA shape probe. Delete app/api/test-nba-sample after use.',
        error: 'NBA league not found in /leagues',
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
      seasonFormat,
      seasonKeys,
    } = pickSeasons(nba)

    const season =
      forcedSeason ||
      detectedSeason ||
      null

    notes.push(
      forcedSeason
        ? `Using season from ?season=${forcedSeason}`
        : detectedSeason
          ? `Using detected/current season ${detectedSeason}`
          : 'Could not detect current season from /leagues',
    )
    notes.push(`Season format observed: ${seasonFormat}`)

    const leagueIdNum = leagueId(nba)
    if (leagueIdNum == null) {
      return NextResponse.json(
        { error: 'NBA league entry missing id', nbaLeague: nba },
        { status: 502 },
      )
    }

    if (!season) {
      return NextResponse.json(
        {
          error: 'Could not resolve NBA season (try ?season=2025-2026)',
          nbaLeague: nba,
          seasons,
          seasonKeys,
          seasonFormat,
        },
        { status: 502 },
      )
    }

    const gamesRes = await apiGet(apiKey, '/games', {
      league: String(leagueIdNum),
      season,
    })

    let games = Array.isArray(gamesRes.body.response)
      ? gamesRes.body.response
      : []

    let gamesMeta: Record<string, unknown> = {
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
        notes.push(
          `date=${date} → results=${byDate.body.results ?? list.length}`,
        )
        if (list.length > 0) {
          games = list
          gamesMeta = {
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

    const classified = games.map((g) => {
      const row = asRecord(g) ?? {}
      const status = asRecord(row.status)
      const short = String(
        status?.short ?? status?.long ?? row.status ?? '',
      ).toUpperCase()
      return { game: g, short }
    })

    const pick = (...preds: ((s: string) => boolean)[]) => {
      for (const pred of preds) {
        const hit = classified.find((c) => pred(c.short))
        if (hit) return hit.game
      }
      return null
    }

    const sampleGamesRaw: unknown[] = []
    const finished = pick(
      (s) =>
        s === 'FT' ||
        s === 'AOT' ||
        s === 'FINISHED' ||
        s.includes('FINAL') ||
        s === 'AWD',
    )
    const live = pick(
      (s) =>
        s.startsWith('Q') ||
        s === 'HT' ||
        s === 'LIVE' ||
        s.includes('PROGRESS') ||
        s === 'BT' ||
        s === 'OT' ||
        s.startsWith('P'),
    )
    const upcoming = pick(
      (s) =>
        s === 'NS' ||
        s === 'TBD' ||
        s === 'SCHEDULED' ||
        s === 'NOT STARTED' ||
        s === '',
    )

    for (const g of [finished, live, upcoming]) {
      if (g && !sampleGamesRaw.includes(g)) sampleGamesRaw.push(g)
    }
    for (const g of games) {
      if (sampleGamesRaw.length >= 3) break
      if (!sampleGamesRaw.includes(g)) sampleGamesRaw.push(g)
    }

    const sampleGames = sampleGamesRaw.slice(0, 3).map((g) => ({
      summarized: summarizeGame(g),
      full: g,
    }))

    const statusCodes = new Map<string, number>()
    for (const { short } of classified) {
      const key = short || '(empty)'
      statusCodes.set(key, (statusCodes.get(key) ?? 0) + 1)
    }

    return NextResponse.json({
      note: 'Throwaway NBA shape probe. Delete app/api/test-nba-sample after use.',
      provider: API_BASE,
      notes,
      nbaLeague: {
        id: leagueIdNum,
        name: leagueName(nba),
        country: leagueCountry(nba),
        entry: nba,
        seasons,
        seasonKeys,
        seasonFormat,
        currentSeason: season,
        detectedSeason,
      },
      gamesQuery: gamesMeta,
      gamesReturned: games.length,
      statusCodeCounts: Object.fromEntries(
        [...statusCodes.entries()].sort((a, b) => b[1] - a[1]),
      ),
      sampleGames,
      mappingHints: {
        team1: 'teams.home (name, id, logo)',
        team2: 'teams.away (name, id, logo)',
        kickoff_at: 'date / timestamp / timezone',
        result_team1_team2:
          'scores.home / scores.away — inspect total vs quarter (q1–q4 / ot)',
        status_short: 'status.short (see statusCodeCounts + sampleGames)',
        fixture_id: 'game id (top-level or game.id)',
        provider_season:
          'Use exact season string from nbaLeague.currentSeason (likely YYYY-YYYY)',
      },
    })
  } catch (error) {
    console.error('test-nba-sample error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    )
  }
}
