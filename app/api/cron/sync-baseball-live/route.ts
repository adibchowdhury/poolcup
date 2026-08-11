import { NextResponse } from 'next/server'
import {
  isCronAuthorized,
  requireCronSecretConfigured,
} from '@/src/lib/cron-auth'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { syncBaseballLiveScores } from '@/src/lib/sync-baseball'
import { withSyncJob } from '@/src/lib/sync-jobs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handleSyncBaseballLive(request: Request) {
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
      { jobType: 'sync_baseball_live' },
      async () => {
        const result = await syncBaseballLiveScores(supabase, apiKey)
        return {
          itemsProcessed: result.matchesChecked,
          itemsChanged: result.matchesUpdated,
          partial: result.errors.length > 0,
          detail: {
            matchesSkipped: result.matchesSkipped,
            pointsScored: result.pointsScored,
            apiMissing: result.apiMissing,
            errorCount: result.errors.length,
            skipped: result.skipped ?? null,
            errors: result.errors.slice(0, 10),
          },
          result,
        }
      },
    )

    if (summary.errors.length > 5) {
      try {
        await sendOpsNtfy(
          `sync-baseball-live: ${summary.errors.length} error(s); updated=${summary.matchesUpdated} scored=${summary.pointsScored}`,
        )
      } catch (notifyError) {
        console.error('sync-baseball-live: ops ntfy failed', notifyError)
      }
    }

    return NextResponse.json({
      success: true,
      ...summary,
    })
  } catch (error) {
    console.error('sync-baseball-live error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    try {
      await sendOpsNtfy(`sync-baseball-live fatal: ${message}`)
    } catch {
      /* ignore */
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleSyncBaseballLive(request)
}

export async function POST(request: Request) {
  return handleSyncBaseballLive(request)
}
