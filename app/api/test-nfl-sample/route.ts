import { NextResponse } from 'next/server'
import {
  isCronAuthorized,
  requireCronSecretConfigured,
} from '@/src/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const API_BASE = 'https://v1.american-football.api-sports.io'

/**
 * Throwaway NFL shape probe. Delete app/api/test-nfl-sample after use.
 *
 * GET /api/test-nfl-sample
 * Auth: Authorization: Bearer $CRON_SECRET  (or x-cron-secret)
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

function isNflLeague(entry: unknown): boolean {
  const name = leagueName(entry).toLowerCase()
  if (!name) return false
  if (name === 'nfl' || name.includes('national football league')) return true
  // Prefer US NFL over other "NFL" acronyms abroad if country present.
  const row = asRecord(entry)
  const country =
    asRecord(row?.country) ??
    asRecord(asRecord(row?.league)?.country) ??
    null
  const countryName = String(country?.name ?? '').toLowerCase()
  const countryCode = String(country?.code ?? '').toUpperCase()
  if (name.includes('nfl') && (countryCode === 'US' || countryName.includes('united states') || countryName === 'usa')) {
    return true
  }
  return name.includes('nfl') && countryCode === 'US'
}

function pickSeasons(entry: unknown): {
  seasons: unknown
  currentSeason: number | null
} {
  const row = asRecord(entry)
  if (!row) return { seasons: null, currentSeason: null }

  const nested = asRecord(row.league)
  // Shapes seen across api-sports products: seasons[], season (number), league.season
  const seasons =
    row.seasons ?? nested?.seasons ?? row.season ?? nested?.season ?? null

  let currentSeason: number | null = null

  if (Array.isArray(seasons)) {
    for (const s of seasons) {
      if (typeof s === 'number' && Number.isFinite(s)) {
        currentSeason = Math.max(currentSeason ?? s, s)
        continue
      }
      const obj = asRecord(s)
      if (!obj) continue
      const year = Number(obj.year ?? obj.season ?? obj)
      const isCurrent = obj.current === true || obj.is_current === true
      if (isCurrent && Number.isFinite(year)) {
        currentSeason = year
        break
      }
      if (Number.isFinite(year)) {
        currentSeason = Math.max(currentSeason ?? year, year)
      }
    }
  } else if (typeof seasons === 'number' && Number.isFinite(seasons)) {
    currentSeason = seasons
  } else if (typeof nested?.season === 'number') {
    currentSeason = nested.season
  } else if (typeof row.season === 'number') {
    currentSeason = row.season
  }

  return { seasons, currentSeason }
}

function summarizeGame(game: unknown): Record<string, unknown> {
  const g = asRecord(game) ?? {}
  const status = asRecord(g.status) ?? g.status
  const teams = asRecord(g.teams) ?? g.teams
  const scores = asRecord(g.scores) ?? g.scores
  const league = asRecord(g.league) ?? g.league
  const gameObj = asRecord(g.game) ?? null

  return {
    // Prefer top-level id; some sports nest under game.id
    id: g.id ?? gameObj?.id ?? null,
    date: g.date ?? gameObj?.date ?? null,
    time: g.time ?? gameObj?.time ?? null,
    timestamp: g.timestamp ?? gameObj?.timestamp ?? null,
    timezone: g.timezone ?? gameObj?.timezone ?? null,
    week: g.week ?? null,
    stage: g.stage ?? null,
    venue: g.venue ?? null,
    status,
    league,
    teams,
    scores,
    // Keep a few extra top-level keys so we don't miss nesting quirks
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

    const nflCandidates = leagues.filter(isNflLeague)
    let nfl =
      nflCandidates.find((e) => leagueName(e).toLowerCase() === 'nfl') ??
      nflCandidates[0] ??
      null

    if (forcedLeague) {
      const forcedId = Number(forcedLeague)
      const match = leagues.find((e) => leagueId(e) === forcedId) ?? null
      if (match) {
        nfl = match
        notes.push(`Forced league id=${forcedLeague}`)
      } else {
        notes.push(`Forced league id=${forcedLeague} not found in /leagues`)
      }
    }

    if (!nfl) {
      return NextResponse.json({
        note: 'Throwaway NFL shape probe. Delete app/api/test-nfl-sample after use.',
        error: 'NFL league not found in /leagues',
        leagueCount: leagues.length,
        leagueNamesSample: leagues.slice(0, 20).map((e) => ({
          id: leagueId(e),
          name: leagueName(e),
        })),
        rawFirstLeague: leagues[0] ?? null,
      })
    }

    const { seasons, currentSeason: detectedSeason } = pickSeasons(nfl)
    const seasonYear = forcedSeason
      ? Number(forcedSeason)
      : detectedSeason ?? new Date().getUTCFullYear()

    if (!Number.isFinite(seasonYear)) {
      return NextResponse.json(
        {
          error: 'Could not resolve NFL season year',
          nflLeague: nfl,
          seasons,
        },
        { status: 502 },
      )
    }

    notes.push(
      forcedSeason
        ? `Using season from ?season=${forcedSeason}`
        : `Using detected/current season ${seasonYear}`,
    )

    const leagueIdNum = leagueId(nfl)
    if (leagueIdNum == null) {
      return NextResponse.json(
        { error: 'NFL league entry missing id', nflLeague: nfl },
        { status: 502 },
      )
    }

    const gamesRes = await apiGet(apiKey, '/games', {
      league: String(leagueIdNum),
      season: String(seasonYear),
    })

    let games = Array.isArray(gamesRes.body.response)
      ? gamesRes.body.response
      : []

    let gamesMeta: Record<string, unknown> = {
      url: gamesRes.url,
      httpStatus: gamesRes.status,
      results: gamesRes.body.results ?? games.length,
      apiErrors: gamesRes.body.errors ?? null,
    }

    // If empty (preseason gap / wrong year), try today + yesterday as a date probe.
    if (games.length === 0) {
      notes.push(
        `No games for league=${leagueIdNum}&season=${seasonYear}; trying date probes`,
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
          season: String(seasonYear),
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

    // Prefer a mix: finished / live / scheduled when available.
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
      (s) => s === 'FT' || s === 'AOT' || s.includes('FINAL') || s === 'FINISHED',
    )
    const live = pick(
      (s) =>
        s.startsWith('Q') ||
        s === 'HT' ||
        s === 'LIVE' ||
        s.includes('PROGRESS') ||
        s === 'BT',
    )
    const upcoming = pick(
      (s) => s === 'NS' || s === 'TBD' || s === 'SCHEDULED' || s === '',
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

    // Distinct status codes across the fetched set (helps mapping).
    const statusCodes = new Map<string, number>()
    for (const { short } of classified) {
      const key = short || '(empty)'
      statusCodes.set(key, (statusCodes.get(key) ?? 0) + 1)
    }

    return NextResponse.json({
      note: 'Throwaway NFL shape probe. Delete app/api/test-nfl-sample after use.',
      provider: API_BASE,
      notes,
      nflLeague: {
        id: leagueIdNum,
        name: leagueName(nfl),
        entry: nfl,
        seasons,
        currentSeason: seasonYear,
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
        result_team1_team2: 'scores.home / scores.away — inspect total vs quarters',
        status_short: 'status.short (see statusCodeCounts + sampleGames)',
        fixture_id: 'game id (top-level or game.id)',
      },
    })
  } catch (error) {
    console.error('test-nfl-sample error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    )
  }
}
