import { NextResponse } from 'next/server'
import {
  isCronAuthorized,
  requireCronSecretConfigured,
} from '@/src/lib/cron-auth'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { syncAmericanFootballFromApi } from '@/src/lib/sync-american-football'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** NFL season payload is modest vs MLB; keep headroom. */
export const maxDuration = 300

async function handleSyncAmericanFootball(request: Request) {
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
    const summary = await syncAmericanFootballFromApi(supabase, apiKey, {
      eventId,
    })

    if (summary.eventsFailed > 0) {
      try {
        await sendOpsNtfy(
          `sync-american-football: ${summary.eventsFailed}/${summary.eventsConsidered} event(s) failed; processed=${summary.gamesProcessed} changed=${summary.gamesChanged} scored=${summary.pointsScored}`,
        )
      } catch (notifyError) {
        console.error('sync-american-football: ops ntfy failed', notifyError)
      }
    }

    return NextResponse.json({
      success: summary.eventsFailed === 0,
      ...summary,
    })
  } catch (error) {
    console.error('sync-american-football error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    try {
      await sendOpsNtfy(`sync-american-football fatal: ${message}`)
    } catch {
      /* ignore */
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleSyncAmericanFootball(request)
}

export async function POST(request: Request) {
  return handleSyncAmericanFootball(request)
}
