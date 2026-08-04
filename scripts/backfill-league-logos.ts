/**
 * Backfill matches.team1_logo / team2_logo for Big 5 + MLS league fixtures.
 * UPDATES logo columns only — does not touch scores, kickoff, names, status, etc.
 * Skips World Cup / non-league rows.
 *
 *   npx ts-node --project tsconfig.json scripts/backfill-league-logos.ts
 *
 * Requires API_FOOTBALL_KEY in .env.local (same as league-ingest).
 */
import * as dotenv from 'dotenv'
import path from 'path'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { normalizeTeamLogoUrl } from '@/src/lib/team-logos'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const API_BASE = 'https://v3.football.api-sports.io'
const SEASON = 2026

/** Same leagues / event IDs as scripts/league-ingest.ts */
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
  fixture: { id: number }
  teams: {
    home: { name: string; logo?: string | null }
    away: { name: string; logo?: string | null }
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

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  console.log('=== Backfill league team logos (UPDATE logos only) ===')
  console.log(`season = ${SEASON}, round filter = league event_ids only\n`)

  const supabase = createAdminSupabaseClient()
  let apiCalls = 0
  let updated = 0
  let skippedNoRow = 0
  let skippedNoLogo = 0
  let failed = 0

  for (const league of LEAGUES) {
    console.log(`\n---------- ${league.name} (league ${league.leagueId}) ----------`)
    const fixtures = await fetchLeagueFixtures(apiKey, league.leagueId)
    apiCalls++
    console.log(`API fixtures: ${fixtures.length}`)

    for (const fixture of fixtures) {
      const fixtureId = String(fixture.fixture.id)
      const team1Logo = normalizeTeamLogoUrl(fixture.teams.home.logo)
      const team2Logo = normalizeTeamLogoUrl(fixture.teams.away.logo)

      if (!team1Logo && !team2Logo) {
        skippedNoLogo++
        continue
      }

      const { data, error } = await supabase
        .from('matches')
        .update({
          team1_logo: team1Logo,
          team2_logo: team2Logo,
        })
        .eq('fixture_id', fixtureId)
        .eq('event_id', league.eventId)
        .eq('round', 'league')
        .select('id')

      if (error) {
        failed++
        console.error(
          `  FAIL fixture_id=${fixtureId}: ${error.message}`,
        )
        continue
      }

      if (!data || data.length === 0) {
        skippedNoRow++
        continue
      }

      updated += data.length
    }

    console.log(`  updated so far: ${updated}`)
  }

  console.log('\n========== BACKFILL TOTAL ==========')
  console.log(`API calls: ${apiCalls}`)
  console.log(`Rows updated: ${updated}`)
  console.log(`Skipped (no DB row / wrong event): ${skippedNoRow}`)
  console.log(`Skipped (API had no logos): ${skippedNoLogo}`)
  console.log(`Failed: ${failed}`)
  console.log('\nDone. Only team1_logo/team2_logo written. WC untouched.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
