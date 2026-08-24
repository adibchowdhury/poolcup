import { NextResponse } from 'next/server'
import {
  GLOBAL_ACTIVITY_DASHBOARD_LIMIT,
  GLOBAL_ACTIVITY_PAGE_LIMIT,
  buildGlobalActivityFeed,
} from '@/src/lib/global-activity-feed-core'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Global community activity for dashboard surfaces.
 * Uses service role to aggregate recent picks across all pools (RLS-safe).
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const scope = url.searchParams.get('scope')
  const limit =
    scope === 'page' ? GLOBAL_ACTIVITY_PAGE_LIMIT : GLOBAL_ACTIVITY_DASHBOARD_LIMIT

  try {
    const admin = createAdminSupabaseClient()
    const result = await buildGlobalActivityFeed(admin, { limit })
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load global activity'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
