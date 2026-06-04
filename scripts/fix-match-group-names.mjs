import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { mapLeagueRoundToGroup } from '../src/lib/world-cup-groups.ts'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const API_URL =
  'https://v3.football.api-sports.io/fixtures?league=1&season=2026'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const apiKey = process.env.API_FOOTBALL_KEY

if (!url || !key || !apiKey) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

const res = await fetch(API_URL, { headers: { 'x-apisports-key': apiKey } })
const raw = await res.json()

if (!res.ok) {
  console.error('API HTTP error', res.status, res.statusText)
  process.exit(1)
}

if (raw.errors && Object.keys(raw.errors).length > 0) {
  console.error('API error', raw.errors)
  process.exit(1)
}

const fixtures = raw.response ?? []
console.log(`Fetched ${fixtures.length} fixtures from API-Football`)

const roundSamples = [...new Set(fixtures.map((f) => f.league.round))].sort()
console.log('API league.round samples:', roundSamples)

for (const sample of fixtures.slice(0, 8)) {
  console.log('map', sample.league.round, '->', mapLeagueRoundToGroup(sample.league.round))
}

let updated = 0
let skipped = 0

for (const fixture of fixtures) {
  const fixtureId = String(fixture.fixture.id)
  const { round, group_name } = mapLeagueRoundToGroup(fixture.league.round)

  if (round !== 'group' || !group_name) {
    skipped++
    continue
  }

  const { error } = await supabase
    .from('matches')
    .update({ group_name })
    .eq('fixture_id', fixtureId)

  if (error) {
    console.warn(`Update failed for ${fixtureId}:`, error.message)
    continue
  }

  updated++
}

console.log(`Updated group_name on ${updated} matches (${skipped} non-group fixtures skipped)`)

const { data: sample } = await supabase
  .from('matches')
  .select('group_name')
  .eq('round', 'group')
  .limit(200)

const unique = [...new Set((sample ?? []).map((r) => r.group_name))].sort()
console.log('Unique group_name values after fix:', unique)
