import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { poolId?: string }
    const poolId = body.poolId

    if (!poolId || typeof poolId !== 'string') {
      return NextResponse.json({ error: 'poolId is required' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()

    // Verify ownership (creator-only delete).
    const { data: pool, error: poolError } = await admin
      .from('pools')
      .select('id, creator_id')
      .eq('id', poolId)
      .maybeSingle()

    if (poolError) {
      console.error('delete-pool: failed to load pool', { poolId, error: poolError })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    if (pool.creator_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete related data first (avoid FK issues).
    const { error: predictionsError } = await admin
      .from('predictions')
      .delete()
      .eq('pool_id', poolId)
    if (predictionsError) {
      console.error('delete-pool: failed to delete predictions', {
        poolId,
        error: predictionsError,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: cacheError } = await admin
      .from('leaderboard_cache')
      .delete()
      .eq('pool_id', poolId)
    if (cacheError) {
      console.error('delete-pool: failed to delete leaderboard cache', {
        poolId,
        error: cacheError,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: membersError } = await admin
      .from('pool_members')
      .delete()
      .eq('pool_id', poolId)
    if (membersError) {
      console.error('delete-pool: failed to delete pool members', {
        poolId,
        error: membersError,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: deleteError } = await admin.from('pools').delete().eq('id', poolId)
    if (deleteError) {
      console.error('delete-pool: failed to delete pool', { poolId, error: deleteError })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('delete-pool error:', error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

