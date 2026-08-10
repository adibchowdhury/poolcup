import { NextResponse } from 'next/server'
import { isCronAuthorized, requireCronSecretConfigured } from '@/src/lib/cron-auth'
import { refreshTeamRosters } from '@/src/lib/refresh-team-rosters'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { withSyncJob } from '@/src/lib/sync-jobs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Weekly roster refresh can take ~1–2 min when many teams are stale. */
export const maxDuration = 300

async function handleRefreshRequest(request: Request) {
  if (!requireCronSecretConfigured()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API_FOOTBALL_KEY is not configured' },
      { status: 500 },
    )
  }

  const supabase = createAdminSupabaseClient()

  try {
    const summary = await withSyncJob(
      supabase,
      { jobType: 'refresh_rosters' },
      async () => {
        const result = await refreshTeamRosters(supabase, apiKey, {
          forceAll: false,
          logger: (message) => console.log(`[refresh-rosters] ${message}`),
        })
        return {
          itemsProcessed: result.teamsProcessed ?? 0,
          itemsChanged: result.playersUpserted ?? 0,
          partial: (result.teamsFailed ?? 0) > 0,
          detail: { ...result },
          result,
        }
      },
    )

    return NextResponse.json({
      success: true,
      ...summary,
    })
  } catch (error) {
    console.error('refresh-rosters error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleRefreshRequest(request)
}

export async function POST(request: Request) {
  return handleRefreshRequest(request)
}
