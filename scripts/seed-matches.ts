import * as dotenv from 'dotenv'
import path from 'path'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const API_URL =
  'https://v3.football.api-sports.io/fixtures?league=1&season=2026'

type ApiFixture = {
  fixture: { id: number; date: string }
  league: { round: string }
  teams: {
    home: { name: string }
    away: { name: string }
  }
}

type ApiFootballResponse = {
  response: ApiFixture[]
  errors?: Record<string, string>
}

type MatchInsert = {
  fixture_id: string
  kickoff_at: string
  locked_at: string
  team1_name: string
  team2_name: string
  team1_flag: string
  team2_flag: string
  round: string
  group_name: string | null
}

const ROUND_LABEL_MAP: Record<string, string> = {
  'Group Stage': 'group',
  'Round of 32': 'r32',
  'Round of 16': 'r16',
  'Quarter-finals': 'qf',
  'Semi-finals': 'sf',
  Final: 'final',
}

function mapRoundAndGroup(leagueRound: string): {
  round: string
  group_name: string | null
} {
  const label = leagueRound.trim()

  const groupMatch = label.match(/Group\s+([A-Za-z])/i)
  if (groupMatch) {
    return { round: 'group', group_name: groupMatch[1].toUpperCase() }
  }

  for (const [apiLabel, round] of Object.entries(ROUND_LABEL_MAP)) {
    if (label.includes(apiLabel)) {
      return { round, group_name: null }
    }
  }

  return { round: 'group', group_name: null }
}

function mapFixture(fixture: ApiFixture): MatchInsert {
  const kickoffAt = fixture.fixture.date
  const { round, group_name } = mapRoundAndGroup(fixture.league.round)

  return {
    fixture_id: String(fixture.fixture.id),
    kickoff_at: kickoffAt,
    locked_at: kickoffAt,
    team1_name: fixture.teams.home.name,
    team2_name: fixture.teams.away.name,
    team1_flag: '',
    team2_flag: '',
    round,
    group_name,
  }
}

async function fetchFixtures(apiKey: string): Promise<ApiFixture[]> {
  console.log(`GET ${API_URL}`)

  const res = await fetch(API_URL, {
    headers: { 'x-apisports-key': apiKey },
  })

  const raw = await res.json()
  console.log('API-Football raw response:')
  console.log(JSON.stringify(raw, null, 2))

  if (!res.ok) {
    throw new Error(
      `API-Football request failed: ${res.status} ${res.statusText}`
    )
  }

  const data = raw as ApiFootballResponse

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`)
  }

  return data.response ?? []
}

async function deleteAllMatches() {
  const supabase = createAdminSupabaseClient()

  const { error: predictionsError } = await supabase
    .from('predictions')
    .delete()
    .not('id', 'is', null)

  if (predictionsError) {
    console.warn(
      'Warning clearing predictions (table may be empty):',
      predictionsError.message
    )
  }

  const { error } = await supabase
    .from('matches')
    .delete()
    .not('fixture_id', 'is', null)

  if (error) {
    throw new Error(`Failed to delete matches: ${error.message}`)
  }
}

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  console.log('Fetching fixtures from API-Football...')
  const fixtures = await fetchFixtures(apiKey)
  console.log(`Fetched ${fixtures.length} fixtures`)

  const rows = fixtures.map(mapFixture)
  const supabase = createAdminSupabaseClient()

  console.log('Deleting existing matches...')
  await deleteAllMatches()

  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('matches').insert(batch)

    if (error) {
      throw new Error(`Insert failed: ${error.message}`)
    }

    inserted += batch.length
  }

  console.log(`Inserted ${inserted} matches into Supabase`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
