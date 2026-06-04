import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const res = await fetch(
  'https://v3.football.api-sports.io/standings?league=1&season=2026',
  { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } },
)
const raw = await res.json()
fs.writeFileSync('standings-sample.json', JSON.stringify(raw, null, 2))
console.log('written standings-sample.json')
const flat = raw.response?.[0]?.league?.standings?.flat?.() ?? []
console.log('flat rows', flat.length)
console.log('groups', [...new Set(flat.map((r) => r.group))].sort())
