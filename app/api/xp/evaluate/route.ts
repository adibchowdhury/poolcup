import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { fetchUserXpTotal, markLastSeenXp, refreshHighestLevel } from '@/src/lib/xp'
import { levelFromXp } from '@/src/lib/levels'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Evaluate newly earned badges for the signed-in user.
 * Badge XP is written to xp_transactions by a DB trigger on user_achievements
 * insert — this route does not call award_xp for achievements.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const admin = createAdminSupabaseClient()
    const xpBefore = await fetchUserXpTotal(admin, user.id)
    const levelBefore = levelFromXp(xpBefore)

    // Self-only: never accept a client-supplied user id. RPC is service_role only.
    const { data: newlyAwardedRaw, error: evalError } = await admin.rpc(
      'evaluate_user_achievements',
      { p_user_id: user.id },
    )

    if (evalError) {
      return NextResponse.json(
        { error: evalError.message, newlyAwardedIds: [] },
        { status: 500 },
      )
    }

    const newlyAwardedIds = Array.isArray(newlyAwardedRaw)
      ? newlyAwardedRaw.map(String)
      : []

    const awards: Array<{ id: string; amount: number; name: string }> = []
    let catalogueXp = 0

    if (newlyAwardedIds.length > 0) {
      const { data: badges } = await admin
        .from('achievements')
        .select('id, name, xp_value')
        .in('id', newlyAwardedIds)

      for (const badge of badges ?? []) {
        const amount = Math.max(0, Number(badge.xp_value) || 0)
        catalogueXp += amount
        awards.push({
          id: badge.id,
          amount,
          name: badge.name ?? 'badge',
        })
      }
    }

    const xpAfter = await fetchUserXpTotal(admin, user.id)
    const levelAfter = levelFromXp(xpAfter)
    const highestLevel = await refreshHighestLevel(admin, user.id)
    // Prefer ledger delta (trigger may have written); fall back to catalogue sum.
    const xpAwarded = Math.max(0, xpAfter - xpBefore, catalogueXp)
    if (xpAwarded > 0) {
      await markLastSeenXp(admin, user.id, { byAmount: xpAwarded })
    }

    return NextResponse.json({
      newlyAwardedIds,
      xpAwarded,
      awards,
      levelBefore,
      levelAfter,
      highestLevel,
      totalXp: xpAfter,
    })
  } catch (error) {
    console.error('xp/evaluate failed', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
