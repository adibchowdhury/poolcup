/**
 * Ingest UEFA Champions League 2025 fixtures into public.matches (ADDITIVE).
 * Skips qualifying + entry Play-offs. Idempotent via upsert on fixture_id
 * with ignoreDuplicates (ON CONFLICT DO NOTHING).
 *
 *   npx ts-node --project tsconfig.json scripts/cl-ingest.ts
 *
 * Does NOT touch World Cup matches, scoring, or /mobile.
 */
import * as dotenv from 'dotenv'
import path from 'path'
import { isFinalStatus } from '@/src/lib/api-football'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SEASON = 2025
const API_BASE = 'https://v3.football.api-sports.io'
const CL_LEAGUE_ID = 2
const CL_EVENT_ID = '4e2a5ddd-3bcd-4c96-b589-38494c62a10b'

const CL_ROUND_CODES = [
  'cl_league',
  'cl_playoff',
  'cl_r16',
  'cl_qf',
  'cl_sf',
  'cl_final',
] as const

type ClRoundCode = (typeof CL_ROUND_CODES)[number]

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

/** Row shape for public.matches insert (CL only). */
type MatchInsert = {
  fixture_id: string
  event_id: string
  kickoff_at: string
  locked_at: string
  team1_name: string
  team2_name: string
  team1_flag: string
  team2_flag: string
  round: ClRoundCode
  group_name: null
  result_team1: number | null
  result_team2: number | null
  status_short: string | null
  is_final: boolean
  elapsed_minute: null
  advancing_team: null
  match_number: null
}

function mapClApiRoundToCode(apiRound: string): ClRoundCode | null {
  const r = apiRound.trim()

  if (/^League Stage/i.test(r)) return 'cl_league'
  if (/^Play-offs$/i.test(r)) return null
  if (/Knockout Round Play-offs/i.test(r) || /^Round of 32$/i.test(r)) {
    return 'cl_playoff'
  }
  if (/Round of 16/i.test(r)) return 'cl_r16'
  if (/Quarter-finals/i.test(r)) return 'cl_qf'
  if (/Semi-finals/i.test(r)) return 'cl_sf'
  if (/^Final$/i.test(r)) return 'cl_final'
  return null
}

function mapFixture(fixture: ApiFixture): MatchInsert | null {
  const round = mapClApiRoundToCode(fixture.league.round ?? '')
  if (!round) return null

  const statusShort = fixture.fixture.status.short?.trim() || null
  const isFinal = statusShort != null && isFinalStatus(statusShort)

  return {
    fixture_id: String(fixture.fixture.id),
    event_id: CL_EVENT_ID,
    kickoff_at: fixture.fixture.date,
    locked_at: fixture.fixture.date,
    team1_name: fixture.teams.home.name,
    team2_name: fixture.teams.away.name,
    team1_flag: '',
    team2_flag: '',
    round,
    group_name: null,
    result_team1: fixture.goals.home,
    result_team2: fixture.goals.away,
    status_short: statusShort,
    is_final: isFinal,
    elapsed_minute: null,
    advancing_team: null,
    match_number: null,
  }
}

async function fetchClFixtures(apiKey: string): Promise<ApiFixture[]> {
  const url = `${API_BASE}/fixtures?league=${CL_LEAGUE_ID}&season=${SEASON}`
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

function countByRound(rows: { round: string }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const code of CL_ROUND_CODES) out[code] = 0
  for (const row of rows) {
    out[row.round] = (out[row.round] ?? 0) + 1
  }
  return out
}

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  console.log('=== CL ingest (ADDITIVE; upsert DO NOTHING on fixture_id) ===')
  console.log(`event_id = ${CL_EVENT_ID}`)
  console.log(`season = ${SEASON}`)
  console.log(
    'Idempotency: supabase.from("matches").upsert(..., { onConflict: "fixture_id", ignoreDuplicates: true })\n',
  )

  const fixtures = await fetchClFixtures(apiKey)
  console.log(`API fixtures total: ${fixtures.length}`)

  const rows: MatchInsert[] = []
  let skippedApi = 0
  for (const f of fixtures) {
    const mapped = mapFixture(f)
    if (!mapped) {
      skippedApi++
      continue
    }
    rows.push(mapped)
  }

  console.log(`Mapped to ingest: ${rows.length}`)
  console.log(`Skipped (qualifying / entry Play-offs / unmapped): ${skippedApi}`)
  console.log('Mapped per cl_ code:', countByRound(rows))

  const supabase = createAdminSupabaseClient()

  // Pre-check existing fixture_ids so we can report inserted vs already-present
  const fixtureIds = rows.map((r) => r.fixture_id)
  const existingIds = new Set<string>()
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
      if (row.fixture_id) existingIds.add(row.fixture_id)
    }
  }

  const alreadyExisting = rows.filter((r) => existingIds.has(r.fixture_id))
  const toInsert = rows.filter((r) => !existingIds.has(r.fixture_id))
  console.log(`\nAlready in DB (same fixture_id): ${alreadyExisting.length}`)
  console.log(`New rows to upsert: ${toInsert.length}`)

  const BATCH_SIZE = 50
  let upsertAttempted = 0
  const failed: { fixture_id: string; message: string }[] = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('matches').upsert(batch, {
      onConflict: 'fixture_id',
      ignoreDuplicates: true,
    })

    if (error) {
      // Fall back to per-row so one bad row doesn't hide the rest
      for (const row of batch) {
        const { error: rowError } = await supabase.from('matches').upsert(row, {
          onConflict: 'fixture_id',
          ignoreDuplicates: true,
        })
        if (rowError) {
          failed.push({ fixture_id: row.fixture_id, message: rowError.message })
        } else {
          upsertAttempted++
        }
      }
      continue
    }

    upsertAttempted += batch.length
  }

  console.log(`Upsert batches completed (rows attempted): ${upsertAttempted}`)
  if (failed.length > 0) {
    console.log(`Failed rows: ${failed.length}`)
    for (const f of failed.slice(0, 20)) {
      console.log(`  fixture_id=${f.fixture_id}: ${f.message}`)
    }
  }

  // Query back CL matches only
  const { data: clMatches, error: queryError } = await supabase
    .from('matches')
    .select('fixture_id, round')
    .eq('event_id', CL_EVENT_ID)

  if (queryError) {
    throw new Error(`Failed to query CL matches: ${queryError.message}`)
  }

  const clRows = clMatches ?? []
  const byCode = countByRound(clRows)
  const expected = {
    total: 189,
    cl_league: 144,
    cl_playoff: 16,
    cl_r16: 16,
    cl_qf: 8,
    cl_sf: 4,
    cl_final: 1,
  }

  console.log('\n--- Query-back (event_id = CL) ---')
  console.log(`Total CL matches in DB: ${clRows.length}`)
  console.log('Per cl_ round code:')
  for (const code of CL_ROUND_CODES) {
    const n = byCode[code] ?? 0
    const exp = expected[code as keyof typeof expected]
    const ok = n === exp ? 'OK' : `EXPECTED ${exp}`
    console.log(`  ${code}: ${n} (${ok})`)
  }

  const totalsMatch =
    clRows.length === expected.total &&
    CL_ROUND_CODES.every((code) => byCode[code] === expected[code])

  console.log(
    `\nMatches dry-run expectations (189; 144/16/16/8/4/1): ${
      totalsMatch ? 'YES' : 'NO — investigate'
    }`,
  )
  console.log(`Inserted (new fixture_ids before upsert): ${toInsert.length}`)
  console.log(
    `Skipped-as-existing (fixture_id already present): ${alreadyExisting.length}`,
  )
  console.log(`API-skipped (qualifying/entry Play-offs): ${skippedApi}`)
  console.log(`Failed upserts: ${failed.length}`)
  console.log('\nDone. World Cup matches untouched. Scoring untouched.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
