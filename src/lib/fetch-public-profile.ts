import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ACHIEVEMENT_SELECT,
  buildAchievementsData,
  type AchievementCatalogueRow,
  type UserAchievementsData,
} from '@/src/lib/fetch-user-achievements'
import { xpToLevel } from '@/src/lib/levels'

export type PublicProfile = {
  id: string
  display_name: string | null
  avatar: string | null
  custom_avatar_url: string | null
  is_supporter: boolean
  created_at: string
  total_xp: number
  badges_earned: number
  predictions_made: number
  accuracy: number | null
}

type UserAchievementRow = {
  achievement_id: string
  earned_at: string
}

function emptyAchievements(error: string | null = null): UserAchievementsData {
  return {
    achievements: [],
    groups: [],
    totalXp: 0,
    earnedCount: 0,
    totalCount: 0,
    level: xpToLevel(0),
    recentlyUnlocked: [],
    newlyAwardedIds: [],
    error,
  }
}

function coercePublicProfile(raw: unknown): PublicProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : null
  if (!id) return null

  const accuracyRaw = row.accuracy
  const accuracy =
    accuracyRaw == null || accuracyRaw === ''
      ? null
      : Math.round(Number(accuracyRaw))

  return {
    id,
    display_name:
      typeof row.display_name === 'string' ? row.display_name : null,
    avatar: typeof row.avatar === 'string' ? row.avatar : null,
    custom_avatar_url:
      typeof row.custom_avatar_url === 'string'
        ? row.custom_avatar_url
        : null,
    is_supporter: Boolean(row.is_supporter),
    created_at:
      typeof row.created_at === 'string' ? row.created_at : '',
    total_xp: Math.max(0, Number(row.total_xp) || 0),
    badges_earned: Math.max(0, Number(row.badges_earned) || 0),
    predictions_made: Math.max(0, Number(row.predictions_made) || 0),
    accuracy:
      accuracy == null || Number.isNaN(accuracy) ? null : accuracy,
  }
}

/**
 * Safe public profile via SECURITY DEFINER RPC.
 * Returns ONLY public fields — never email or private UX state.
 */
export async function fetchPublicProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<PublicProfile | null> {
  if (!userId) return null

  const { data, error } = await supabase.rpc('get_public_profile', {
    p_user_id: userId,
  })

  if (error) {
    console.error('get_public_profile failed:', error.message)
    return null
  }

  if (Array.isArray(data)) {
    return coercePublicProfile(data[0] ?? null)
  }
  return coercePublicProfile(data)
}

/**
 * READ-ONLY achievements for a public profile.
 * NEVER calls evaluate_user_achievements (side-effecting).
 */
export async function fetchUserAchievementsReadOnly(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserAchievementsData> {
  if (!userId) return emptyAchievements('Missing user.')

  const [catalogueRes, earnedRes] = await Promise.all([
    supabase
      .from('achievements')
      .select(ACHIEVEMENT_SELECT)
      .order('sort_order', { ascending: true }),
    supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', userId),
  ])

  if (catalogueRes.error) {
    return emptyAchievements(catalogueRes.error.message)
  }
  if (earnedRes.error) {
    return emptyAchievements(earnedRes.error.message)
  }

  return buildAchievementsData(
    (catalogueRes.data ?? []) as AchievementCatalogueRow[],
    (earnedRes.data ?? []) as UserAchievementRow[],
    [],
    null,
  )
}
