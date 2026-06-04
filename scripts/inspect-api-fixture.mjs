import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const res = await fetch(
  'https://v3.football.api-sports.io/fixtures?league=1&season=2026',
  { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } },
)
const raw = await res.json()
console.log(JSON.stringify(raw.response?.[0], null, 2))
console.log('---')
console.log(JSON.stringify(raw.response?.[1], null, 2))
