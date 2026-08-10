import { NextResponse } from 'next/server'
import {
  isCronAuthorized,
  requireCronSecretConfigured,
} from '@/src/lib/cron-auth'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { syncFixturesFromApiFootball } from '@/src/lib/sync-fixtures'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Multiple leagues × full-season fixture payloads. */
export const maxDuration = 300

async function handleSyncFixtures(request: Request) {
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
    const summary = await syncFixturesFromApiFootball(supabase, apiKey, {
      eventId,
    })

    if (summary.eventsFailed > 0) {
      try {
        await sendOpsNtfy(
          `sync-fixtures: ${summary.eventsFailed}/${summary.eventsConsidered} event(s) failed; processed=${summary.fixturesProcessed} changed=${summary.fixturesChanged}`,
        )
      } catch (notifyError) {
        console.error('sync-fixtures: ops ntfy failed', notifyError)
      }
    }

    return NextResponse.json({
      success: summary.eventsFailed === 0,
      ...summary,
    })
  } catch (error) {
    console.error('sync-fixtures error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    try {
      await sendOpsNtfy(`sync-fixtures fatal: ${message}`)
    } catch {
      /* ignore */
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleSyncFixtures(request)
}

export async function POST(request: Request) {
  return handleSyncFixtures(request)
}
