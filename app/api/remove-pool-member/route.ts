import { NextResponse } from 'next/server'
import {
  fetchIsPoolAdmin,
  fetchIsPoolOwner,
  logPoolModeration,
} from '@/src/lib/pool-admin'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

/**
 * Admin (owner or co-commissioner): remove a member from a pool.
 *
 * Co-commissioners may remove ONLY regular members (not owner, not other admins).
 * Owner may remove any non-owner member; if target is a co-commissioner,
 * demote via remove_co_commissioner first, then delete membership.
 *
 * Cascades predictions / group_predictions / leaderboard_cache via FK.
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

    const actorIsAdmin = await fetchIsPoolAdmin(admin, poolId, user.id)
    if (!actorIsAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const actorIsOwner = await fetchIsPoolOwner(admin, poolId, user.id)

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

    const targetUserId = member.user_id as string
    const targetIsOwner = await fetchIsPoolOwner(admin, poolId, targetUserId)
    if (targetIsOwner) {
      return NextResponse.json(
        { error: 'Cannot remove the pool owner' },
        { status: 400 },
      )
    }

    const targetIsAdmin = await fetchIsPoolAdmin(admin, poolId, targetUserId)

    if (!actorIsOwner) {
      // Co-commissioner: regular members only.
      if (targetIsAdmin) {
        return NextResponse.json(
          {
            error:
              'Co-commissioners cannot remove the owner or other co-commissioners',
          },
          { status: 403 },
        )
      }
    } else if (targetIsAdmin) {
      // Owner removing a co-commissioner: demote first.
      const { error: demoteError } = await admin.rpc('remove_co_commissioner', {
        p_actor_id: user.id,
        p_pool_id: poolId,
        p_user_id: targetUserId,
      })
      if (demoteError) {
        console.error('remove-pool-member: demote failed', demoteError.message)
        return NextResponse.json(
          { error: demoteError.message || 'Could not demote co-commissioner' },
          { status: 400 },
        )
      }
    }

    // Not FK-cascaded from pool_members (keyed by user_id + pool_id).
    const { error: thirdPlaceError } = await admin
      .from('third_place_rankings')
      .delete()
      .eq('pool_id', poolId)
      .eq('user_id', targetUserId)

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

    await logPoolModeration(admin, {
      poolId,
      actorId: user.id,
      action: 'member_removed',
      targetUserId,
      detail: { memberId },
    })

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
