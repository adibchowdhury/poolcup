import { NextResponse } from 'next/server'
import {
  fetchIsPoolOwner,
  listCoCommissioners,
} from '@/src/lib/pool-admin'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

/** Owner-only: list co-commissioners. */
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
  const isOwner = await fetchIsPoolOwner(admin, poolId, user.id)
  if (!isOwner) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const coCommissioners = await listCoCommissioners(admin, poolId)
  return NextResponse.json({ coCommissioners })
}

/** Owner-only: add a co-commissioner (must be a pool member). */
export async function POST(request: Request, context: Ctx) {
  const { poolId } = await context.params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { userId?: string }
  try {
    body = (await request.json()) as { userId?: string }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const targetUserId = body.userId?.trim()
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId_required' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { error } = await admin.rpc('add_co_commissioner', {
    p_actor_id: user.id,
    p_pool_id: poolId,
    p_user_id: targetUserId,
  })

  if (error) {
    console.error('add_co_commissioner failed:', error.message)
    return NextResponse.json(
      { error: error.message || 'add_failed' },
      { status: 400 },
    )
  }

  const coCommissioners = await listCoCommissioners(admin, poolId)
  return NextResponse.json({ success: true, coCommissioners })
}

/** Owner-only: remove a co-commissioner. */
export async function DELETE(request: Request, context: Ctx) {
  const { poolId } = await context.params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { userId?: string }
  try {
    body = (await request.json()) as { userId?: string }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const targetUserId = body.userId?.trim()
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId_required' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { error } = await admin.rpc('remove_co_commissioner', {
    p_actor_id: user.id,
    p_pool_id: poolId,
    p_user_id: targetUserId,
  })

  if (error) {
    console.error('remove_co_commissioner failed:', error.message)
    return NextResponse.json(
      { error: error.message || 'remove_failed' },
      { status: 400 },
    )
  }

  const coCommissioners = await listCoCommissioners(admin, poolId)
  return NextResponse.json({ success: true, coCommissioners })
}
