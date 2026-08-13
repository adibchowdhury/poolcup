import { NextResponse } from 'next/server'
import { fetchIsPoolAdmin } from '@/src/lib/pool-admin'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

/** Admin-only: members missing upcoming predictions. */
export async function GET(_request: Request, context: Ctx) {
  const { poolId } = await context.params

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

  const { data, error } = await admin.rpc('get_members_missing_predictions', {
    p_actor_id: user.id,
    p_pool_id: poolId,
  })

  if (error) {
    console.error('get_members_missing_predictions failed:', error.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  return NextResponse.json({ rows: Array.isArray(data) ? data : [] })
}
