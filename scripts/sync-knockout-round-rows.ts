import * as dotenv from 'dotenv'
import path from 'path'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import {
  KNOCKOUT_ROUND_CREATE_ORDER,
  MATCH_NUMBER_CONSTRAINT_NOTE,
  syncKnockoutRoundRows,
  type KnockoutRoundCreateTarget,
} from '@/src/lib/sync-knockout-round-rows'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function parseRoundFilter(): KnockoutRoundCreateTarget | null {
  const arg = process.argv.find((value) => value.startsWith('--round='))
  if (!arg) return null

  const round = arg.slice('--round='.length).trim().toLowerCase()
  if (
    !(KNOCKOUT_ROUND_CREATE_ORDER as readonly string[]).includes(round)
  ) {
    throw new Error(
      `Invalid --round=${round}; expected one of: ${KNOCKOUT_ROUND_CREATE_ORDER.join(', ')}`,
    )
  }

  return round as KnockoutRoundCreateTarget
}

async function main() {
  const commit = process.argv.includes('--commit')
  const dryRun = process.argv.includes('--dry-run') || !commit
  const roundFilter = parseRoundFilter()

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  const supabase = createAdminSupabaseClient()

  const summary = await syncKnockoutRoundRows({
    dryRun,
    roundFilter,
    apiKey,
    supabase,
  })

  console.log(
    JSON.stringify(
      {
        match_number_constraint: MATCH_NUMBER_CONSTRAINT_NOTE,
        ...summary,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
