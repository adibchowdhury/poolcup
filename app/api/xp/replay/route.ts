import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { levelFromXp } from '@/src/lib/levels'
import {
  attributeUnseenXp,
  fetchLastSeenXp,
  fetchUserXpTotal,
  markLastSeenXp,
  PREDICTION_XP_SOURCES,
  type XpReplayResult,
} from '@/src/lib/xp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PREDICTION_SET = new Set<string>(PREDICTION_XP_SOURCES)

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
    const seen = await fetchLastSeenXp(admin, user.id)
    const totalXp = await fetchUserXpTotal(admin, user.id)
    const levelAfter = levelFromXp(totalXp)

    if (seen == null) {
      const empty: XpReplayResult = {
        seeded: true,
        awarded: 0,
        predictionAwarded: 0,
        bySource: {},
        levelBefore: levelAfter,
        levelAfter,
        totalXp,
      }
      return NextResponse.json(empty)
    }

    if (seen.last_seen_xp == null) {
      await markLastSeenXp(admin, user.id, { toTotal: true })
      const seeded: XpReplayResult = {
        seeded: true,
        awarded: 0,
        predictionAwarded: 0,
        bySource: {},
        levelBefore: levelAfter,
        levelAfter,
        totalXp,
      }
      return NextResponse.json(seeded)
    }

    const awarded = Math.max(0, totalXp - seen.last_seen_xp)
    const levelBefore = seen.last_seen_level ?? levelFromXp(seen.last_seen_xp)
    const bySource =
      awarded > 0 ? await attributeUnseenXp(admin, user.id, awarded) : {}
    const predictionAwarded = Object.entries(bySource).reduce(
      (sum, [source, amount]) =>
        PREDICTION_SET.has(source) ? sum + amount : sum,
      0,
    )

    await markLastSeenXp(admin, user.id, { toTotal: true })

    const result: XpReplayResult = {
      seeded: false,
      awarded,
      predictionAwarded,
      bySource,
      levelBefore,
      levelAfter,
      totalXp,
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('xp/replay failed', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
