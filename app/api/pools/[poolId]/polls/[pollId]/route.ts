import { NextResponse } from 'next/server'
import { fetchIsPoolAdmin } from '@/src/lib/pool-admin'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string; pollId: string }> }

/** Admin soft-delete via delete_poll. */
export async function DELETE(_request: Request, context: Ctx) {
  const { poolId, pollId } = await context.params
  if (!poolId || !pollId) {
    return NextResponse.json({ error: 'missing_ids' }, { status: 400 })
  }

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

  const { error } = await admin.rpc('delete_poll', {
    p_actor_id: user.id,
    p_poll_id: pollId,
  })

  if (error) {
    console.error('delete_poll failed:', error.message)
    const msg = error.message || 'delete_failed'
    if (msg.includes('not_pool_admin')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    if (msg.includes('poll_not_found')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
