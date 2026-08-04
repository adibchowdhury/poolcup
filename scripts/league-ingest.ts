/**
 * Ingest Big 5 + MLS 2026 league fixtures into public.matches (ADDITIVE).
 * All matches use round='league' (plain scoring). Idempotent via upsert on
 * fixture_id with ignoreDuplicates (ON CONFLICT DO NOTHING).
 *
 *   npx ts-node --project tsconfig.json scripts/league-ingest.ts
 *
 * Does NOT touch World Cup, CL, scoring, schema, or /mobile.
 */
import * as dotenv from 'dotenv'
import path from 'path'
import { isFinalStatus } from '@/src/lib/api-football'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const API_BASE = 'https://v3.football.api-sports.io'
const SEASON = 2026
const ROUND = 'league' as const

const LEAGUES = [
  {
    name: 'Premier League',
    eventId: 'ee7c34b7-b4b1-4373-b893-6757f67222ff',
    leagueId: 39,
  },
  {
    name: 'La Liga',
    eventId: '96eba9a0-59aa-44f5-9bc9-941c4e0f950a',
    leagueId: 140,
  },
  {
    name: 'Serie A',
    eventId: '72fce046-7642-4883-a49e-39ec4ee3cd40',
    leagueId: 135,
  },
  {
    name: 'Bundesliga',
    eventId: '5fd8bfd4-e426-4ada-9473-0f073e74d426',
    leagueId: 78,
  },
  {
    name: 'Ligue 1',
    eventId: '977182d8-a108-45ea-be13-f39ad6875888',
    leagueId: 61,
  },
  {
    name: 'MLS',
    eventId: '2babcb7a-24c4-4652-9d3b-d76410cb6fe5',
    leagueId: 253,
  },
] as const

type ApiFixture = {
  fixture: {
    id: number
    date: string
    status: { short: string | null; elapsed: number | null }
  }
  teams: {
    home: { name: string; logo: string | null }
    away: { name: string; logo: string | null }
  }
  goals: {
    home: number | null
    away: number | null
  }
}

type MatchInsert = {
  fixture_id: string
  event_id: string
  kickoff_at: string
  locked_at: string
  team1_name: string
  team2_name: string
  team1_flag: null
  team2_flag: null
  team1_logo: string | null
  team2_logo: string | null
  round: typeof ROUND
  group_name: null
  result_team1: number | null
  result_team2: number | null
  status_short: string | null
  is_final: boolean
  elapsed_minute: number | null
  advancing_team: null
  match_number: null
}

function mapFixture(fixture: ApiFixture, eventId: string): MatchInsert {
  const statusShort = fixture.fixture.status.short?.trim() || null
  const isFinal = statusShort != null && isFinalStatus(statusShort)
  const homeLogo =
    typeof fixture.teams.home.logo === 'string' &&
    fixture.teams.home.logo.trim()
      ? fixture.teams.home.logo.trim()
      : null
  const awayLogo =
    typeof fixture.teams.away.logo === 'string' &&
    fixture.teams.away.logo.trim()
      ? fixture.teams.away.logo.trim()
      : null

  return {
    fixture_id: String(fixture.fixture.id),
    event_id: eventId,
    kickoff_at: fixture.fixture.date,
    locked_at: fixture.fixture.date,
    // Convention: home → team1, away → team2 (same as goals).
    team1_name: fixture.teams.home.name,
    team2_name: fixture.teams.away.name,
    team1_flag: null,
    team2_flag: null,
    team1_logo: homeLogo,
    team2_logo: awayLogo,
    round: ROUND,
    group_name: null,
    result_team1: fixture.goals.home,
    result_team2: fixture.goals.away,
    status_short: statusShort,
    is_final: isFinal,
    elapsed_minute: fixture.fixture.status.elapsed,
    advancing_team: null,
    match_number: null,
  }
}

async function fetchLeagueFixtures(
  apiKey: string,
  leagueId: number,
): Promise<ApiFixture[]> {
  const url = `${API_BASE}/fixtures?league=${leagueId}&season=${SEASON}`
  console.log(`GET ${url}`)

  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const raw = (await res.json()) as {
    response?: ApiFixture[]
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

  return raw.response ?? []
}

async function lookupExistingFixtureIds(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  fixtureIds: string[],
): Promise<Set<string>> {
  const existing = new Set<string>()
  const LOOKUP_BATCH = 100
  for (let i = 0; i < fixtureIds.length; i += LOOKUP_BATCH) {
    const batch = fixtureIds.slice(i, i + LOOKUP_BATCH)
    const { data, error } = await supabase
      .from('matches')
      .select('fixture_id')
      .in('fixture_id', batch)

    if (error) {
      throw new Error(`Failed to look up existing fixture_ids: ${error.message}`)
    }
    for (const row of data ?? []) {
      if (row.fixture_id) existing.add(row.fixture_id)
    }
  }
  return existing
}

async function upsertRows(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  rows: MatchInsert[],
): Promise<{ attempted: number; failed: { fixture_id: string; message: string }[] }> {
  const BATCH_SIZE = 50
  let attempted = 0
  const failed: { fixture_id: string; message: string }[] = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('matches').upsert(batch, {
      onConflict: 'fixture_id',
      ignoreDuplicates: true,
    })

    if (error) {
      for (const row of batch) {
        const { error: rowError } = await supabase.from('matches').upsert(row, {
          onConflict: 'fixture_id',
          ignoreDuplicates: true,
        })
        if (rowError) {
          failed.push({ fixture_id: row.fixture_id, message: rowError.message })
        } else {
          attempted++
        }
      }
      continue
    }

    attempted += batch.length
  }

  return { attempted, failed }
}

type QueryBackStats = {
  total: number
  ns: number
  finished: number
  minKickoff: string | null
  maxKickoff: string | null
}

async function queryBackEvent(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  eventId: string,
): Promise<QueryBackStats> {
  const { data, error } = await supabase
    .from('matches')
    .select('kickoff_at, status_short, is_final')
    .eq('event_id', eventId)

  if (error) {
    throw new Error(`Failed to query event ${eventId}: ${error.message}`)
  }

  const rows = data ?? []
  let ns = 0
  let finished = 0
  let minKickoff: string | null = null
  let maxKickoff: string | null = null

  for (const row of rows) {
    const st = (row.status_short ?? '').trim().toUpperCase()
    if (st === 'NS') ns++
    if (row.is_final) finished++

    const k = row.kickoff_at as string
    if (!minKickoff || k < minKickoff) minKickoff = k
    if (!maxKickoff || k > maxKickoff) maxKickoff = k
  }

  return {
    total: rows.length,
    ns,
    finished,
    minKickoff,
    maxKickoff,
  }
}

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  console.log('=== League ingest (Big 5 + MLS, ADDITIVE) ===')
  console.log(`season = ${SEASON}, round = '${ROUND}'`)
  console.log(
    'Idempotency: upsert onConflict fixture_id, ignoreDuplicates: true\n',
  )

  const supabase = createAdminSupabaseClient()
  let apiCalls = 0
  let grandNew = 0
  let grandExisting = 0
  let grandFailed = 0
  let grandDbTotal = 0
  let grandNs = 0
  let grandFinished = 0

  for (const league of LEAGUES) {
    console.log(`\n---------- ${league.name} (league ${league.leagueId}) ----------`)
    console.log(`event_id = ${league.eventId}`)

    const fixtures = await fetchLeagueFixtures(apiKey, league.leagueId)
    apiCalls++
    console.log(`API fixtures: ${fixtures.length}`)

    const rows = fixtures.map((f) => mapFixture(f, league.eventId))
    const existingIds = await lookupExistingFixtureIds(
      supabase,
      rows.map((r) => r.fixture_id),
    )
    const alreadyExisting = rows.filter((r) => existingIds.has(r.fixture_id))
    const toInsert = rows.filter((r) => !existingIds.has(r.fixture_id))
    console.log(`Already in DB: ${alreadyExisting.length}`)
    console.log(`New to upsert: ${toInsert.length}`)

    const { attempted, failed } = await upsertRows(supabase, rows)
    console.log(`Upsert attempted: ${attempted}`)
    if (failed.length > 0) {
      console.log(`Failed: ${failed.length}`)
      for (const f of failed.slice(0, 10)) {
        console.log(`  fixture_id=${f.fixture_id}: ${f.message}`)
      }
    }

    const stats = await queryBackEvent(supabase, league.eventId)
    console.log(`Query-back total: ${stats.total}`)
    console.log(`  NS (upcoming): ${stats.ns}`)
    console.log(`  finished (is_final): ${stats.finished}`)
    console.log(`  kickoff range: ${stats.minKickoff} → ${stats.maxKickoff}`)

    grandNew += toInsert.length
    grandExisting += alreadyExisting.length
    grandFailed += failed.length
    grandDbTotal += stats.total
    grandNs += stats.ns
    grandFinished += stats.finished
  }

  console.log('\n========== GRAND TOTAL ==========')
  console.log(`API calls: ${apiCalls} (expected 6)`)
  console.log(`New inserts (pre-check): ${grandNew}`)
  console.log(`Skipped-as-existing: ${grandExisting}`)
  console.log(`Failed upserts: ${grandFailed}`)
  console.log(`DB matches across 6 events: ${grandDbTotal}`)
  console.log(`  NS: ${grandNs}`)
  console.log(`  finished: ${grandFinished}`)
  console.log('\nDone. WC/CL untouched. Scoring untouched.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
