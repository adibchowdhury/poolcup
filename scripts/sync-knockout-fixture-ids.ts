import * as dotenv from 'dotenv'
import path from 'path'
import { KNOCKOUT_ROUND_IDS } from '@/src/lib/classic-round-tab-logic'
import {
  buildFixtureIdOwnerMap,
  fetchWc2026SeasonFixtures,
  isKnockoutApiFixture,
  resolveKnockoutFixtureIdForRow,
  type DbMatchForFixtureSync,
} from '@/src/lib/fixture-id-sync'
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

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const roundFilter = parseRoundFilter()
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  const supabase = createAdminSupabaseClient()

  let query = supabase
    .from('matches')
    .select('id, fixture_id, round, kickoff_at, team1_name, team2_name')
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
  const fixtureIdOwnerByFixtureId = buildFixtureIdOwnerMap(rows)

  const allFixtures = await fetchWc2026SeasonFixtures(apiKey)
  const knockoutApiFixtures = allFixtures.filter(isKnockoutApiFixture)

  const summary = {
    dry_run: dryRun,
    round_filter: roundFilter,
    knockout_rows: rows.length,
    api_knockout_fixtures: knockoutApiFixtures.length,
    already_synced: [] as Array<Record<string, unknown>>,
    updated: [] as Array<Record<string, unknown>>,
    skipped: [] as Array<Record<string, unknown>>,
  }

  for (const row of rows) {
    const outcome = resolveKnockoutFixtureIdForRow(
      row,
      knockoutApiFixtures,
      fixtureIdOwnerByFixtureId,
    )

    if (outcome.status === 'already_synced') {
      summary.already_synced.push({
        match_id: row.id,
        round: row.round,
        fixture_id: outcome.fixtureId,
        team1_name: row.team1_name,
        team2_name: row.team2_name,
        kickoff_at: row.kickoff_at,
      })
      continue
    }

    if (outcome.status === 'skipped') {
      summary.skipped.push({
        match_id: row.id,
        round: row.round,
        fixture_id: row.fixture_id,
        team1_name: row.team1_name,
        team2_name: row.team2_name,
        kickoff_at: row.kickoff_at,
        reason: outcome.reason,
      })
      continue
    }

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ fixture_id: outcome.fixtureId })
        .eq('id', row.id)

      if (updateError) {
        throw new Error(
          `Failed to update match ${row.id} with fixture_id ${outcome.fixtureId}: ${updateError.message}`,
        )
      }
    }

    fixtureIdOwnerByFixtureId.set(outcome.fixtureId, row.id)

    summary.updated.push({
      match_id: row.id,
      round: row.round,
      previous_fixture_id: row.fixture_id,
      fixture_id: outcome.fixtureId,
      team1_name: row.team1_name,
      team2_name: row.team2_name,
      kickoff_at: row.kickoff_at,
    })
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
