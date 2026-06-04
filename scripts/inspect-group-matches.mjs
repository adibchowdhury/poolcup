import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(url, key)

const { data, error } = await supabase
  .from('matches')
  .select('round, group_name, team1_name, team2_name')
  .limit(500)

if (error) {
  console.error(error.message)
  process.exit(1)
}

console.log('total matches', data.length)
const rounds = [...new Set(data.map((m) => m.round))]
console.log('unique rounds', rounds)

const groupStage = data.filter((m) => m.round === 'group')
console.log('group round count', groupStage.length)

const groupNames = [...new Set(groupStage.map((m) => m.group_name))]
console.log('unique group_name values', groupNames.slice(0, 20))

console.log('sample group stage rows', JSON.stringify(groupStage.slice(0, 6), null, 2))
