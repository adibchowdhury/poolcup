/**
 * Dry-run: fetch UEFA Champions League fixtures from API-Football and report
 * what would be inserted into matches. WRITE NOTHING to the database.
 *
 *   npx ts-node --project tsconfig.json scripts/cl-ingest-dryrun.ts
 */
import * as dotenv from 'dotenv'
import path from 'path'
import { isFinalStatus } from '@/src/lib/api-football'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// ─── CONFIG: change season here ─────────────────────────────────────────────
/** Default: most complete recent edition with league stage + knockout (2025). */
const SEASON = 2025

const API_BASE = 'https://v3.football.api-sports.io'
const CL_LEAGUE_ID = 2

/** Codes that stay OUT of WC knockout set so calculate_match_points uses plain scoring. */
export const CL_ROUND_CODES = [
  'cl_league',
  'cl_playoff',
  'cl_r16',
  'cl_qf',
  'cl_sf',
  'cl_final',
] as const

export type ClRoundCode = (typeof CL_ROUND_CODES)[number]

const WC_KNOCKOUT_CODES = ['r32', 'r16', 'qf', 'sf', 'third', 'final'] as const

type LeagueSeason = {
  year: number
  current: boolean
  start: string
  end: string
}

type ApiFixture = {
  fixture: {
    id: number
    date: string
    status: { short: string | null; elapsed: number | null }
  }
  league: { round: string }
  teams: {
    home: { name: string }
    away: { name: string }
  }
  goals: {
    home: number | null
    away: number | null
  }
}

type MappedMatch = {
  fixture_id: string
  kickoff_at: string
  locked_at: string
  team1_name: string
  team2_name: string
  result_team1: number | null
  result_team2: number | null
  status_short: string | null
  elapsed_minute: number | null
  is_final: boolean
  api_round: string
  round: ClRoundCode
  group_name: null
}

async function apiGet<T>(apiKey: string, pathAndQuery: string): Promise<T> {
  const url = `${API_BASE}${pathAndQuery}`
  console.log(`GET ${url}`)

  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const raw = (await res.json()) as {
    response?: T
    errors?: Record<string, string>
  }

  if (!res.ok) {
    throw new Error(
      `API-Football request failed: ${res.status} ${res.statusText}`,
    )
  }

  if (raw.errors && Object.keys(raw.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(raw.errors)}`)
  }

  return (raw.response ?? []) as T
}

/**
 * Map API-Football CL round strings → our cl_* codes.
 * Returns null for qualifying / unmapped rounds (skip on ingest).
 */
export function mapClApiRoundToCode(apiRound: string): ClRoundCode | null {
  const r = apiRound.trim()

  if (/^League Stage/i.test(r)) return 'cl_league'

  // Entry play-offs into league phase (not knockout play-offs)
  if (/^Play-offs$/i.test(r)) return null

  if (/Knockout Round Play-offs/i.test(r) || /^Round of 32$/i.test(r)) {
    return 'cl_playoff'
  }

  if (/Round of 16/i.test(r)) return 'cl_r16'
  if (/Quarter-finals/i.test(r)) return 'cl_qf'
  if (/Semi-finals/i.test(r)) return 'cl_sf'
  if (/^Final$/i.test(r)) return 'cl_final'

  // Qualifying + anything else → skip
  return null
}

function mapFixture(fixture: ApiFixture): MappedMatch | { skip: true; api_round: string; reason: string } {
  const apiRound = fixture.league.round ?? ''
  const round = mapClApiRoundToCode(apiRound)

  if (!round) {
    const reason = /qualif/i.test(apiRound)
      ? 'qualifying (skip)'
      : /^Play-offs$/i.test(apiRound)
        ? 'entry play-offs into league phase (skip by default)'
        : 'unmapped API round (skip)'
    return { skip: true, api_round: apiRound, reason }
  }

  const statusShort = fixture.fixture.status.short?.trim() || null
  const isFinal = statusShort != null && isFinalStatus(statusShort)

  return {
    fixture_id: String(fixture.fixture.id),
    kickoff_at: fixture.fixture.date,
    locked_at: fixture.fixture.date,
    team1_name: fixture.teams.home.name,
    team2_name: fixture.teams.away.name,
    result_team1: fixture.goals.home,
    result_team2: fixture.goals.away,
    status_short: statusShort,
    elapsed_minute: fixture.fixture.status.elapsed,
    is_final: isFinal,
    api_round: apiRound,
    round,
    group_name: null,
  }
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) {
    const k = keyFn(item)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

function sortCountKeys(counts: Record<string, number>): string[] {
  return Object.keys(counts).sort((a, b) => a.localeCompare(b))
}

async function summarizeSeason(
  apiKey: string,
  year: number,
): Promise<{
  year: number
  total: number
  byApiRound: Record<string, number>
  hasLeagueStage: boolean
  hasKnockout: boolean
  finished: number
  upcomingNs: number
}> {
  const fixtures = await apiGet<ApiFixture[]>(
    apiKey,
    `/fixtures?league=${CL_LEAGUE_ID}&season=${year}`,
  )
  const byApiRound = countBy(fixtures, (f) => f.league.round || '?')
  const now = Date.now()
  let finished = 0
  let upcomingNs = 0
  for (const f of fixtures) {
    const st = (f.fixture.status.short || '').toUpperCase()
    if (isFinalStatus(st)) finished++
    else if (st === 'NS' && new Date(f.fixture.date).getTime() > now) upcomingNs++
  }
  const rounds = Object.keys(byApiRound)
  const hasLeagueStage = rounds.some((r) => /League Stage/i.test(r))
  const hasKnockout = rounds.some(
    (r) =>
      /Round of 16|Quarter-finals|Semi-finals|^Final$|Knockout Round Play-offs|Round of 32/i.test(
        r,
      ),
  )
  return {
    year,
    total: fixtures.length,
    byApiRound,
    hasLeagueStage,
    hasKnockout,
    finished,
    upcomingNs,
  }
}

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  console.log('=== CL ingest DRY-RUN (no DB writes) ===\n')
  console.log(`CONFIG SEASON = ${SEASON}`)
  console.log(`CL league_id = ${CL_LEAGUE_ID}`)
  console.log(`Target round codes: ${CL_ROUND_CODES.join(', ')}`)
  console.log(
    `WC knockout codes (must not collide): ${WC_KNOCKOUT_CODES.join(', ')}\n`,
  )

  // 1) Seasons available
  type LeagueRow = {
    league: { id: number; name: string }
    seasons: LeagueSeason[]
  }
  const leagues = await apiGet<LeagueRow[]>(apiKey, `/leagues?id=${CL_LEAGUE_ID}`)
  const league = leagues[0]
  if (!league) throw new Error('No league returned for id=2')

  console.log(`League: ${league.league.name} (id=${league.league.id})`)
  console.log('Seasons from /leagues?id=2:')
  for (const s of league.seasons) {
    console.log(
      `  year=${s.year} current=${s.current} start=${s.start} end=${s.end}`,
    )
  }

  // Probe recent seasons for league-stage + knockout completeness
  const years = [...league.seasons.map((s) => s.year)].sort((a, b) => b - a)
  const probeYears = years.slice(0, 3)
  console.log(`\n--- Season fixture probes (recent ${probeYears.length}) ---`)
  const seasonSummaries = []
  for (const year of probeYears) {
    const summary = await summarizeSeason(apiKey, year)
    seasonSummaries.push(summary)
    console.log(
      `  ${year}: total=${summary.total} finished=${summary.finished} upcomingNS=${summary.upcomingNs}` +
        ` leagueStage=${summary.hasLeagueStage} knockout=${summary.hasKnockout}`,
    )
    if (!summary.hasLeagueStage || !summary.hasKnockout) {
      console.log(
        `         API rounds: ${Object.keys(summary.byApiRound).join(' | ')}`,
      )
    }
  }

  const completeRecent = seasonSummaries.find(
    (s) => s.hasLeagueStage && s.hasKnockout,
  )
  console.log(
    `\nMost complete recent season with league stage + knockout: ${
      completeRecent?.year ?? '(none in probe)'
    }`,
  )
  console.log(`Using CONFIG SEASON=${SEASON} for mapping report.\n`)

  // 2) Fetch CONFIG season fixtures
  const fixtures = await apiGet<ApiFixture[]>(
    apiKey,
    `/fixtures?league=${CL_LEAGUE_ID}&season=${SEASON}`,
  )
  const byApiRound = countBy(fixtures, (f) => f.league.round || '?')

  console.log(`--- Fixtures for season ${SEASON} ---`)
  console.log(`Total fixtures from API: ${fixtures.length}`)
  console.log('Breakdown by API round string:')
  for (const round of sortCountKeys(byApiRound)) {
    console.log(`  ${byApiRound[round]}\t${round}`)
  }

  // 3) Round mapper documentation + apply
  console.log('\n--- CL round mapper (API string → our code) ---')
  console.log('  /^League Stage/i              → cl_league')
  console.log('  /Knockout Round Play-offs/i   → cl_playoff')
  console.log('  /^Round of 32$/i              → cl_playoff')
  console.log('  /Round of 16/i                → cl_r16')
  console.log('  /Quarter-finals/i             → cl_qf')
  console.log('  /Semi-finals/i                → cl_sf')
  console.log('  /^Final$/i                    → cl_final')
  console.log('  /^Play-offs$/i                → SKIP (entry play-offs)')
  console.log('  /qualif/i (1st/2nd/3rd …)      → SKIP')
  console.log('  anything else                 → SKIP (flagged)')

  const ingested: MappedMatch[] = []
  const skipped: { api_round: string; reason: string }[] = []

  for (const f of fixtures) {
    const mapped = mapFixture(f)
    if ('skip' in mapped) {
      skipped.push({ api_round: mapped.api_round, reason: mapped.reason })
    } else {
      ingested.push(mapped)
    }
  }

  const uniqueApiRounds = sortCountKeys(byApiRound)
  console.log('\nPer-API-round mapping result:')
  for (const apiRound of uniqueApiRounds) {
    const code = mapClApiRoundToCode(apiRound)
    const n = byApiRound[apiRound]
    if (code) {
      console.log(`  ${n}\t"${apiRound}" → ${code}`)
    } else {
      const sample = skipped.find((s) => s.api_round === apiRound)
      console.log(
        `  ${n}\t"${apiRound}" → SKIP (${sample?.reason ?? 'unmapped'})`,
      )
    }
  }

  // 4) Sample ~10
  const samplePool = [
    ...ingested.filter((m) => m.round === 'cl_league').slice(0, 2),
    ...ingested.filter((m) => m.round === 'cl_playoff').slice(0, 2),
    ...ingested.filter((m) => m.round === 'cl_r16').slice(0, 2),
    ...ingested.filter((m) => m.round === 'cl_qf').slice(0, 1),
    ...ingested.filter((m) => m.round === 'cl_sf').slice(0, 1),
    ...ingested.filter((m) => m.round === 'cl_final').slice(0, 1),
  ]
  // pad if a stage missing
  while (samplePool.length < 10 && samplePool.length < ingested.length) {
    const next = ingested.find((m) => !samplePool.includes(m))
    if (!next) break
    samplePool.push(next)
  }

  console.log('\n--- Sample mapped fixtures (would-be rows) ---')
  for (const m of samplePool.slice(0, 10)) {
    const score =
      m.result_team1 != null && m.result_team2 != null
        ? `${m.result_team1}-${m.result_team2}`
        : '—'
    console.log(
      `  ${m.team1_name} vs ${m.team2_name} | ${m.kickoff_at} | "${m.api_round}" → ${m.round} | ${score} ${m.status_short ?? ''} final=${m.is_final} fixture_id=${m.fixture_id}`,
    )
  }

  // 5) Totals
  const byClCode = countBy(ingested, (m) => m.round)
  const skippedByRound = countBy(skipped, (s) => s.api_round)
  const skippedByReason = countBy(skipped, (s) => s.reason)

  console.log('\n--- Totals (DRY-RUN; nothing written) ---')
  console.log(`Would ingest: ${ingested.length}`)
  console.log('Per cl_ code:')
  for (const code of CL_ROUND_CODES) {
    console.log(`  ${code}: ${byClCode[code] ?? 0}`)
  }
  console.log(`Skipped: ${skipped.length}`)
  console.log('Skipped by reason:')
  for (const reason of sortCountKeys(skippedByReason)) {
    console.log(`  ${skippedByReason[reason]}\t${reason}`)
  }
  console.log('Skipped by API round:')
  for (const r of sortCountKeys(skippedByRound)) {
    console.log(`  ${skippedByRound[r]}\t${r}`)
  }

  const collisions = CL_ROUND_CODES.filter((c) =>
    (WC_KNOCKOUT_CODES as readonly string[]).includes(c),
  )
  console.log(
    `\nCollision check vs WC knockout codes: ${
      collisions.length === 0
        ? 'NONE — all cl_* codes are distinct from r32/r16/qf/sf/third/final'
        : `COLLISION: ${collisions.join(', ')}`
    }`,
  )
  console.log(
    'Plain scoring: cl_* codes are outside WC knockout set → calculate_match_points else-branch (unchanged).',
  )
  console.log('\nDRY-RUN complete. No DB inserts performed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
