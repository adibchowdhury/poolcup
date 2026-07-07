import * as dotenv from 'dotenv'
import path from 'path'
import { KNOCKOUT_ROUND_IDS } from '@/src/lib/classic-round-tab-logic'
import {
  apiFixtureRound,
  fetchWc2026SeasonFixtures,
  isKnockoutApiFixture,
  syncKnockoutFixtureIdsCore,
  type ApiFixtureForSync,
  type DbMatchForFixtureSync,
} from '@/src/lib/fixture-id-sync'
import { areSameTeamName } from '@/src/lib/team-flags'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function parseRoundFilter(): string | null {
  const arg = process.argv.find((value) => value.startsWith('--round='))
  if (!arg) return null

  const round = arg.slice('--round='.length).trim().toLowerCase()
  if (!(KNOCKOUT_ROUND_IDS as readonly string[]).includes(round)) {
    throw new Error(
      `Invalid --round=${round}; expected one of: ${KNOCKOUT_ROUND_IDS.join(', ')}`,
    )
  }

  return round
}

/** Same order-insensitive pair check as resolveKnockoutFixtureIdForRow (read-only diagnostic). */
function teamsMatchUnorderedForReconcile(
  dbTeam1: string,
  dbTeam2: string,
  apiHome: string,
  apiAway: string,
): boolean {
  return (
    (areSameTeamName(dbTeam1, apiHome) && areSameTeamName(dbTeam2, apiAway)) ||
    (areSameTeamName(dbTeam1, apiAway) && areSameTeamName(dbTeam2, apiHome))
  )
}

function printR16ReconcileReport(
  rows: DbMatchForFixtureSync[],
  knockoutApiFixtures: ApiFixtureForSync[],
): void {
  const r16ApiFixtures = knockoutApiFixtures.filter(
    (fixture) => apiFixtureRound(fixture) === 'r16',
  )
  const r16Rows = rows.filter((row) => row.round === 'r16')

  console.log('\n=== API R16 FIXTURES ===')
  for (const fixture of r16ApiFixtures) {
    const home = fixture.teams.home.name
    const away = fixture.teams.away.name
    console.log(
      `  fixtureId ${fixture.fixture.id} | ${home} vs ${away} | kickoff ${fixture.fixture.date}`,
    )
  }

  console.log('\n=== OUR R16 ROWS ===')
  for (const row of r16Rows) {
    console.log(
      `  ${row.team1_name} vs ${row.team2_name} | fixture_id ${row.fixture_id ?? 'null'} | kickoff_at ${row.kickoff_at}`,
    )
  }

  console.log('\n=== RECONCILIATION ===')
  for (const row of r16Rows) {
    const ourTeams = `${row.team1_name} vs ${row.team2_name}`
    const matched = r16ApiFixtures.find((fixture) =>
      teamsMatchUnorderedForReconcile(
        row.team1_name,
        row.team2_name,
        fixture.teams.home.name,
        fixture.teams.away.name,
      ),
    )

    if (matched) {
      const apiHome = matched.teams.home.name
      const apiAway = matched.teams.away.name
      console.log(
        `  MATCH: ${ourTeams} -> fixtureId ${matched.fixture.id}, apiTeams "${apiHome}/${apiAway}", kickoff ${matched.fixture.date}`,
      )
      continue
    }

    const candidates = r16ApiFixtures.filter(
      (fixture) =>
        areSameTeamName(row.team1_name, fixture.teams.home.name) ||
        areSameTeamName(row.team1_name, fixture.teams.away.name) ||
        areSameTeamName(row.team2_name, fixture.teams.home.name) ||
        areSameTeamName(row.team2_name, fixture.teams.away.name),
    )

    if (candidates.length === 0) {
      console.log(`  NO MATCH: ${ourTeams} -> absent from API`)
      continue
    }

    console.log(`  NO MATCH: ${ourTeams} ->`)
    for (const fixture of candidates) {
      const apiHome = fixture.teams.home.name
      const apiAway = fixture.teams.away.name
      console.log(
        `    candidate fixtureId ${fixture.fixture.id} "${apiHome}/${apiAway}"`,
      )
    }
  }
  console.log('')
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const reconcile = process.argv.includes('--reconcile')
  const roundFilter = parseRoundFilter()
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  const supabase = createAdminSupabaseClient()

  let query = supabase
    .from('matches')
    .select('id, fixture_id, round, kickoff_at, locked_at, team1_name, team2_name')
    .in('round', [...KNOCKOUT_ROUND_IDS])
    .order('kickoff_at', { ascending: true })

  if (roundFilter) {
    query = query.eq('round', roundFilter)
  }

  const { data: knockoutRows, error: loadError } = await query
  if (loadError) {
    throw new Error(`Failed to load knockout matches: ${loadError.message}`)
  }

  const rows = (knockoutRows ?? []) as DbMatchForFixtureSync[]

  const allFixtures = await fetchWc2026SeasonFixtures(apiKey)
  const knockoutApiFixtures = allFixtures.filter(isKnockoutApiFixture)

  if (reconcile) {
    printR16ReconcileReport(rows, knockoutApiFixtures)
  }

  const summary = await syncKnockoutFixtureIdsCore(supabase, apiKey, {
    dryRun,
    roundFilter,
    rows,
    apiFixtures: knockoutApiFixtures,
  })

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
