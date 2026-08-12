import type { SupabaseClient } from '@supabase/supabase-js'
import { levelFromXp } from '@/src/lib/levels'
import {
  ACHIEVEMENT_XP_SOURCE,
  awardXpAdmin,
  fetchUserXpTotal,
  friendshipXpSourceId,
  refreshHighestLevel,
  utcDateStamp,
  XP_ACTION_AMOUNTS,
  type XpAwardResult,
} from '@/src/lib/xp'

async function snapshot(
  admin: SupabaseClient,
  userId: string,
  awarded: number,
  sourceType: string,
  sourceId: string,
): Promise<XpAwardResult> {
  const total = await fetchUserXpTotal(admin, userId)
  const levelAfter = levelFromXp(total)
  const levelBefore = levelFromXp(Math.max(0, total - awarded))
  const highestLevel = await refreshHighestLevel(admin, userId)
  return {
    awarded,
    sourceType,
    sourceId,
    levelBefore,
    levelAfter,
    highestLevel,
    alreadyHad: awarded === 0,
  }
}

export async function awardActionXp(
  admin: SupabaseClient,
  params: {
    userId: string
    sourceType: keyof typeof XP_ACTION_AMOUNTS
    sourceId: string
    description: string
  },
): Promise<XpAwardResult> {
  const amount = XP_ACTION_AMOUNTS[params.sourceType]
  const awarded = await awardXpAdmin(admin, {
    userId: params.userId,
    amount,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    description: params.description,
  })
  return snapshot(
    admin,
    params.userId,
    awarded,
    params.sourceType,
    params.sourceId,
  )
}

export async function awardAchievementXp(
  admin: SupabaseClient,
  userId: string,
  achievementId: string,
  xpValue: number,
  name: string,
): Promise<number> {
  if (!achievementId || xpValue <= 0) return 0
  const awarded = await awardXpAdmin(admin, {
    userId,
    amount: xpValue,
    sourceType: ACHIEVEMENT_XP_SOURCE,
    sourceId: achievementId,
    description: `Unlocked ${name}`,
  })
  if (awarded > 0) {
    await refreshHighestLevel(admin, userId)
  }
  return awarded
}

export { utcDateStamp, friendshipXpSourceId }
