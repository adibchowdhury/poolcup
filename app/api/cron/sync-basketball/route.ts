import { NextResponse } from 'next/server'
import {
  isCronAuthorized,
  requireCronSecretConfigured,
} from '@/src/lib/cron-auth'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { syncBasketballFromApi } from '@/src/lib/sync-basketball'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Full NBA season payload can be large (~1.4k games). */
export const maxDuration = 300

async function handleSyncBasketball(request: Request) {
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

  const url = new URL(request.url)
  const eventId = url.searchParams.get('event_id')?.trim() || null

  try {
    const supabase = createAdminSupabaseClient()
    const summary = await syncBasketballFromApi(supabase, apiKey, { eventId })

    if (summary.eventsFailed > 0) {
      try {
        await sendOpsNtfy(
          `sync-basketball: ${summary.eventsFailed}/${summary.eventsConsidered} event(s) failed; processed=${summary.gamesProcessed} changed=${summary.gamesChanged} scored=${summary.pointsScored}`,
        )
      } catch (notifyError) {
        console.error('sync-basketball: ops ntfy failed', notifyError)
      }
    }

    return NextResponse.json({
      success: summary.eventsFailed === 0,
      ...summary,
    })
  } catch (error) {
    console.error('sync-basketball error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    try {
      await sendOpsNtfy(`sync-basketball fatal: ${message}`)
    } catch {
      /* ignore */
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleSyncBasketball(request)
}

export async function POST(request: Request) {
  return handleSyncBasketball(request)
}
