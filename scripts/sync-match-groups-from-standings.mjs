import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import {
  buildTeamToGroupMap,
  parseGroupLetter,
  resolveMatchGroupLetter,
} from '../src/lib/world-cup-groups.ts'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const apiKey = process.env.API_FOOTBALL_KEY

if (!url || !key || !apiKey) {
  console.error('Missing required env vars')
  process.exit(1)
}

const supabase = createClient(url, key)

const standingsRes = await fetch(
  'https://v3.football.api-sports.io/standings?league=1&season=2026',
  { headers: { 'x-apisports-key': apiKey } },
)
const standingsRaw = await standingsRes.json()
const rows = standingsRaw.response?.[0]?.league?.standings?.flat() ?? []
const teamToGroup = buildTeamToGroupMap(rows)

console.log(`Team→group map: ${teamToGroup.size} teams`)

const { data: matches, error } = await supabase
  .from('matches')
  .select('id, fixture_id, round, group_name, team1_name, team2_name')
  .eq('round', 'group')

if (error) {
  console.error(error.message)
  process.exit(1)
}

let updated = 0
for (const match of matches ?? []) {
  const letter = resolveMatchGroupLetter(match, teamToGroup)
  if (!letter) continue

  if (parseGroupLetter(match.group_name) === letter) continue

  const { error: updateError } = await supabase
    .from('matches')
    .update({ group_name: letter })
    .eq('id', match.id)

  if (updateError) {
    console.warn(`Failed ${match.fixture_id}:`, updateError.message)
    continue
  }
  updated++
}

console.log(`Updated ${updated} matches`)

const { data: sample } = await supabase
  .from('matches')
  .select('group_name')
  .eq('round', 'group')

const unique = [...new Set((sample ?? []).map((r) => r.group_name))].sort()
console.log('Unique group_name after sync:', unique)
