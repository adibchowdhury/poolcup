/**
 * Manual team-roster ingest (full refresh of every catalog team).
 * Shared logic lives in src/lib/refresh-team-rosters.ts (also used by cron).
 *
 *   npx ts-node --project tsconfig.json scripts/ingest-rosters.ts
 *
 * Requires API_FOOTBALL_KEY + Supabase service role in .env.local.
 * Does NOT touch matches, scoring, or schema.
 */
import * as dotenv from 'dotenv'
import path from 'path'
import { refreshTeamRosters } from '@/src/lib/refresh-team-rosters'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  const supabase = createAdminSupabaseClient()
  await refreshTeamRosters(supabase, apiKey, {
    forceAll: true,
    logger: (message) => console.log(message),
  })

  console.log('\nDone. Re-run anytime to refresh all rosters.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
