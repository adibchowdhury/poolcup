import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import {
  normalizePredictionStreak,
  type StreakMilestoneAward,
  type StreakSyncResponse,
} from '@/src/lib/prediction-streak'
import { fetchUserXpTotal, markLastSeenXp, refreshHighestLevel } from '@/src/lib/xp'
import { levelFromXp } from '@/src/lib/levels'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function loadStreak(admin: ReturnType<typeof createAdminSupabaseClient>, userId: string) {
  const { data, error } = await admin.rpc('get_prediction_streak', {
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
  return normalizePredictionStreak(data)
}

/**
 * Read own prediction-day streak (auth required, self only).
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const admin = createAdminSupabaseClient()
    const streak = await loadStreak(admin, userId)
    return NextResponse.json(streak)
  } catch (error) {
    console.error('streak GET failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'internal' },
      { status: 500 },
    )
  }
}

/**
 * Sync streak watermark + award newly crossed day milestones (service role).
 * Self only — never accepts a client-supplied user id.
 */
export async function POST() {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const admin = createAdminSupabaseClient()
    const streak = await loadStreak(admin, userId)

    const { data: seenRow, error: seenError } = await admin
      .from('users')
      .select('last_seen_streak')
      .eq('id', userId)
      .maybeSingle()

    if (seenError) {
      return NextResponse.json({ error: seenError.message }, { status: 500 })
    }

    const lastSeen = Math.max(0, Number(seenRow?.last_seen_streak) || 0)
    const current = streak.current_streak

    const milestones: StreakMilestoneAward[] = []
    let xpAwarded = 0
    const xpBefore = await fetchUserXpTotal(admin, userId)
    const levelBefore = levelFromXp(xpBefore)

    if (current > lastSeen) {
      const { data: awardedRaw, error: awardError } = await admin.rpc(
        'award_streak_milestones',
        {
          p_user_id: userId,
          p_current_streak: current,
        },
      )
      if (awardError) {
        return NextResponse.json({ error: awardError.message }, { status: 500 })
      }
      for (const row of Array.isArray(awardedRaw) ? awardedRaw : []) {
        const milestone = Math.max(0, Number(row?.milestone) || 0)
        const amount = Math.max(0, Number(row?.xp_awarded) || 0)
        if (milestone > 0 && amount > 0) {
          milestones.push({ milestone, xp_awarded: amount })
          xpAwarded += amount
        }
      }
    }

    // Always advance watermark to current (covers breaks with no negative celebration).
    if (current !== lastSeen) {
      const { error: updateError } = await admin
        .from('users')
        .update({ last_seen_streak: current })
        .eq('id', userId)
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    const xpAfter = await fetchUserXpTotal(admin, userId)
    const levelAfter = levelFromXp(xpAfter)
    const highestLevel = await refreshHighestLevel(admin, userId)
    const ledgerDelta = Math.max(0, xpAfter - xpBefore)
    const awarded = Math.max(xpAwarded, ledgerDelta)
    if (awarded > 0) {
      await markLastSeenXp(admin, userId, { byAmount: awarded })
    }

    const body: StreakSyncResponse = {
      ...streak,
      last_seen_streak: current,
      milestones,
      xpAwarded: awarded,
      levelBefore,
      levelAfter,
      highestLevel,
      totalXp: xpAfter,
    }
    return NextResponse.json(body)
  } catch (error) {
    console.error('streak POST failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'internal' },
      { status: 500 },
    )
  }
}
