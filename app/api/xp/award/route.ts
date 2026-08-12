import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import {
  awardActionXp,
  friendshipXpSourceId,
  utcDateStamp,
} from '@/src/lib/xp-award-server'
import { markLastSeenXp, XP_ACTION_AMOUNTS } from '@/src/lib/xp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AwardBody = {
  sourceType?: string
  sourceId?: string
  inviterUserId?: string
  otherUserId?: string
}

const CLIENT_SOURCES = new Set<keyof typeof XP_ACTION_AMOUNTS>([
  'pool_join',
  'pool_create',
  'invite_accepted',
  'friend_added',
  'pool_chat_first',
  'daily_active',
  'onboarding_complete',
])

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AwardBody
    const sourceType = body.sourceType?.trim() as keyof typeof XP_ACTION_AMOUNTS
    if (!sourceType || !CLIENT_SOURCES.has(sourceType)) {
      return NextResponse.json({ error: 'invalid_source' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const admin = createAdminSupabaseClient()
    const sourceId = (body.sourceId ?? '').trim()

    if (sourceType === 'daily_active') {
      const day = utcDateStamp()
      const result = await awardActionXp(admin, {
        userId: user.id,
        sourceType: 'daily_active',
        sourceId: day,
        description: 'Daily active',
      })
      if (result.awarded > 0) {
        await markLastSeenXp(admin, user.id, { byAmount: result.awarded })
      }
      return NextResponse.json(result)
    }

    if (sourceType === 'onboarding_complete') {
      const { data: row } = await admin
        .from('users')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()
      if (!row?.onboarding_completed) {
        return NextResponse.json({ error: 'onboarding_incomplete' }, { status: 409 })
      }
      const result = await awardActionXp(admin, {
        userId: user.id,
        sourceType: 'onboarding_complete',
        sourceId: 'onboarding',
        description: 'Completed onboarding',
      })
      if (result.awarded > 0) {
        await markLastSeenXp(admin, user.id, { byAmount: result.awarded })
      }
      return NextResponse.json(result)
    }

    if (sourceType === 'pool_join') {
      if (!sourceId) {
        return NextResponse.json({ error: 'missing_source_id' }, { status: 400 })
      }
      const { data: member } = await admin
        .from('pool_members')
        .select('id')
        .eq('pool_id', sourceId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!member) {
        return NextResponse.json({ error: 'not_a_member' }, { status: 403 })
      }
      const result = await awardActionXp(admin, {
        userId: user.id,
        sourceType: 'pool_join',
        sourceId,
        description: 'Joined a pool',
      })
      if (result.awarded > 0) {
        await markLastSeenXp(admin, user.id, { byAmount: result.awarded })
      }
      return NextResponse.json(result)
    }

    if (sourceType === 'pool_create') {
      if (!sourceId) {
        return NextResponse.json({ error: 'missing_source_id' }, { status: 400 })
      }
      const { data: pool } = await admin
        .from('pools')
        .select('id, creator_id')
        .eq('id', sourceId)
        .maybeSingle()
      if (!pool || pool.creator_id !== user.id) {
        return NextResponse.json({ error: 'not_creator' }, { status: 403 })
      }
      const result = await awardActionXp(admin, {
        userId: user.id,
        sourceType: 'pool_create',
        sourceId,
        description: 'Created a pool',
      })
      if (result.awarded > 0) {
        await markLastSeenXp(admin, user.id, { byAmount: result.awarded })
      }
      return NextResponse.json(result)
    }

    if (sourceType === 'invite_accepted') {
      if (!sourceId) {
        return NextResponse.json({ error: 'missing_source_id' }, { status: 400 })
      }
      const inviterUserId = body.inviterUserId?.trim()
      if (!inviterUserId || inviterUserId === user.id) {
        return NextResponse.json({ error: 'invalid_inviter' }, { status: 400 })
      }
      const { data: member } = await admin
        .from('pool_members')
        .select('id')
        .eq('pool_id', sourceId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!member) {
        return NextResponse.json({ error: 'not_a_member' }, { status: 403 })
      }
      const result = await awardActionXp(admin, {
        userId: inviterUserId,
        sourceType: 'invite_accepted',
        sourceId: member.id,
        description: 'Invite accepted',
      })
      return NextResponse.json(result)
    }

    if (sourceType === 'friend_added') {
      const otherUserId = body.otherUserId?.trim()
      if (!otherUserId || otherUserId === user.id) {
        return NextResponse.json({ error: 'invalid_friend' }, { status: 400 })
      }
      const { data: friendship } = await admin
        .from('friendships')
        .select('id, requester_id, addressee_id, status')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`,
        )
        .eq('status', 'accepted')
        .maybeSingle()
      if (!friendship) {
        return NextResponse.json({ error: 'not_friends' }, { status: 403 })
      }
      const pairId = friendshipXpSourceId(user.id, otherUserId)
      const selfResult = await awardActionXp(admin, {
        userId: user.id,
        sourceType: 'friend_added',
        sourceId: pairId,
        description: 'Added a friend',
      })
      await awardActionXp(admin, {
        userId: otherUserId,
        sourceType: 'friend_added',
        sourceId: pairId,
        description: 'Added a friend',
      })
      if (selfResult.awarded > 0) {
        await markLastSeenXp(admin, user.id, { byAmount: selfResult.awarded })
      }
      return NextResponse.json(selfResult)
    }

    if (sourceType === 'pool_chat_first') {
      if (!sourceId) {
        return NextResponse.json({ error: 'missing_source_id' }, { status: 400 })
      }
      const { data: message } = await admin
        .from('pool_messages')
        .select('id')
        .eq('pool_id', sourceId)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (!message) {
        return NextResponse.json({ error: 'no_message' }, { status: 403 })
      }
      const result = await awardActionXp(admin, {
        userId: user.id,
        sourceType: 'pool_chat_first',
        sourceId,
        description: 'First message in a pool',
      })
      if (result.awarded > 0) {
        await markLastSeenXp(admin, user.id, { byAmount: result.awarded })
      }
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'invalid_source' }, { status: 400 })
  } catch (error) {
    console.error('xp/award failed', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
