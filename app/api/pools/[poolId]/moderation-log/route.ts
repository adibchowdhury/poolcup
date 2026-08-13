import { NextResponse } from 'next/server'
import { fetchIsPoolAdmin } from '@/src/lib/pool-admin'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

/** Admin-only moderation history. */
export async function GET(request: Request, context: Ctx) {
  const { poolId } = await context.params
  const url = new URL(request.url)
  const limitRaw = Number(url.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.floor(limitRaw)))
    : 50

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const isAdmin = await fetchIsPoolAdmin(admin, poolId, user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await admin.rpc('get_pool_moderation_log', {
    p_actor_id: user.id,
    p_pool_id: poolId,
    p_limit: limit,
  })

  if (error) {
    console.error('get_pool_moderation_log failed:', error.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  return NextResponse.json({ rows: Array.isArray(data) ? data : [] })
}
