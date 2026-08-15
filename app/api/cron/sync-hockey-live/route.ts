import { NextResponse } from 'next/server'
import {
  isCronAuthorized,
  requireCronSecretConfigured,
} from '@/src/lib/cron-auth'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { syncHockeyLiveScores } from '@/src/lib/sync-hockey'
import { withSyncJob } from '@/src/lib/sync-jobs'
import {
  notifySyncFatalIfSustained,
  notifySyncRecoveryIfNeeded,
} from '@/src/lib/sync-ops-alert'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handleSyncHockeyLive(request: Request) {
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
      { jobType: 'sync_hockey_live' },
      async () => {
        const result = await syncHockeyLiveScores(supabase, apiKey)
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

    try {
      await notifySyncRecoveryIfNeeded(supabase, {
        jobType: 'sync_hockey_live',
        routeLabel: 'sync-hockey-live',
      })
    } catch {
      /* ignore */
    }

    if (summary.errors.length > 5) {
      try {
        await sendOpsNtfy(
          `sync-hockey-live: ${summary.errors.length} error(s); updated=${summary.matchesUpdated} scored=${summary.pointsScored}`,
        )
      } catch (notifyError) {
        console.error('sync-hockey-live: ops ntfy failed', notifyError)
      }
    }

    return NextResponse.json({
      success: true,
      ...summary,
    })
  } catch (error) {
    console.error('sync-hockey-live error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    try {
      await notifySyncFatalIfSustained(supabase, {
        jobType: 'sync_hockey_live',
        routeLabel: 'sync-hockey-live',
        message,
      })
    } catch {
      /* ignore */
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleSyncHockeyLive(request)
}

export async function POST(request: Request) {
  return handleSyncHockeyLive(request)
}
