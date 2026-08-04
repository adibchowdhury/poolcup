import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

/**
 * Creator-only: remove a member from a pool.
 * Deletes the pool_members row; predictions / group_predictions /
 * leaderboard_cache / related rows cascade via FK ON DELETE CASCADE.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as {
      poolId?: string
      memberId?: string
    }
    const poolId = body.poolId
    const memberId = body.memberId

    if (!poolId || typeof poolId !== 'string') {
      return NextResponse.json({ error: 'poolId is required' }, { status: 400 })
    }
    if (!memberId || typeof memberId !== 'string') {
      return NextResponse.json(
        { error: 'memberId is required' },
        { status: 400 },
      )
    }

    const admin = createAdminSupabaseClient()

    const { data: pool, error: poolError } = await admin
      .from('pools')
      .select('id, creator_id')
      .eq('id', poolId)
      .maybeSingle()

    if (poolError) {
      console.error('remove-pool-member: failed to load pool', {
        poolId,
        error: poolError,
      })
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      )
    }

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    if (pool.creator_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: member, error: memberError } = await admin
      .from('pool_members')
      .select('id, user_id, pool_id')
      .eq('id', memberId)
      .eq('pool_id', poolId)
      .maybeSingle()

    if (memberError) {
      console.error('remove-pool-member: failed to load member', {
        poolId,
        memberId,
        error: memberError,
      })
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      )
    }

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (member.user_id === pool.creator_id) {
      return NextResponse.json(
        { error: 'Cannot remove the pool creator' },
        { status: 400 },
      )
    }

    // Not FK-cascaded from pool_members (keyed by user_id + pool_id).
    const { error: thirdPlaceError } = await admin
      .from('third_place_rankings')
      .delete()
      .eq('pool_id', poolId)
      .eq('user_id', member.user_id)

    if (thirdPlaceError) {
      console.error('remove-pool-member: failed to clear third_place_rankings', {
        poolId,
        memberId,
        error: thirdPlaceError,
      })
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      )
    }

    // Cascades predictions, group_predictions, leaderboard_cache, pool_activity.
    const { error: deleteError } = await admin
      .from('pool_members')
      .delete()
      .eq('id', memberId)
      .eq('pool_id', poolId)

    if (deleteError) {
      console.error('remove-pool-member: failed to delete member', {
        poolId,
        memberId,
        error: deleteError,
      })
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('remove-pool-member error:', error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
