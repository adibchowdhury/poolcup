import { NextResponse } from 'next/server'
import { isCronAuthorized, requireCronSecretConfigured } from '@/src/lib/cron-auth'
import { tryRefreshMatchCrowdPicks } from '@/src/lib/match-crowd-picks'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { withSyncJob } from '@/src/lib/sync-jobs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

async function handleCaptureStandings(request: Request) {
  if (!requireCronSecretConfigured()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  try {
    const summary = await withSyncJob(
      supabase,
      { jobType: 'capture_standings_snapshots' },
      async () => {
        const { data, error } = await supabase.rpc('capture_standings_snapshots')
        if (error) throw new Error(error.message)

        await tryRefreshMatchCrowdPicks(supabase, 'capture-standings')

        const changed =
          typeof data === 'number'
            ? data
            : typeof data === 'object' && data != null && 'count' in data
              ? Number((data as { count: unknown }).count) || 0
              : 0

        return {
          itemsProcessed: changed,
          itemsChanged: changed,
          detail: { rpcResult: data ?? null },
          result: { captured: changed, rpcResult: data ?? null },
        }
      },
    )

    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('capture-standings error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleCaptureStandings(request)
}

export async function POST(request: Request) {
  return handleCaptureStandings(request)
}
