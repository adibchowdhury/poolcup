import { NextResponse } from 'next/server'
import { refreshTeamRosters } from '@/src/lib/refresh-team-rosters'
import { secureCompare } from '@/src/lib/secure-compare'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Weekly roster refresh can take ~1–2 min when many teams are stale. */
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null
  if (bearerToken && secureCompare(bearerToken, cronSecret)) return true

  const cronHeader = request.headers.get('x-cron-secret')
  if (cronHeader && secureCompare(cronHeader, cronSecret)) return true

  return false
}

async function handleRefreshRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API_FOOTBALL_KEY is not configured' },
      { status: 500 },
    )
  }

  try {
    const supabase = createAdminSupabaseClient()
    const summary = await refreshTeamRosters(supabase, apiKey, {
      forceAll: false,
      logger: (message) => console.log(`[refresh-rosters] ${message}`),
    })

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
