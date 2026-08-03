import type { SupabaseClient } from '@supabase/supabase-js'
import { achievementBadgeImageSrc } from '@/src/lib/achievement-badge-art'
import {
  type AchievementCatalogueRow,
  type AchievementWithStatus,
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

function normalizeTierLabel(tier: string | null | undefined): string {
  const value = (tier ?? '').trim()
  if (!value || value === '—' || value === '-') return ''
  return value
}

function groupByCategory(achievements: AchievementWithStatus[]) {
  const order: string[] = []
  const map = new Map<string, AchievementWithStatus[]>()

  for (const badge of achievements) {
    if (!map.has(badge.category)) {
      order.push(badge.category)
      map.set(badge.category, [])
    }
    map.get(badge.category)!.push(badge)
  }

  return order.map((category) => ({
    category,
    badges: map.get(category)!,
  }))
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
      .select(
        'id, name, description, category, condition_metric, threshold, tier, xp_value, buildable, sort_order',
      )
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

  const catalogue = (catalogueRes.data ?? []) as AchievementCatalogueRow[]
  const earnedRows = (earnedRes.data ?? []) as UserAchievementRow[]
  const earnedAtById = new Map(
    earnedRows.map((row) => [row.achievement_id, row.earned_at] as const),
  )

  const achievements: AchievementWithStatus[] = catalogue.map((row) => {
    const earned_at = earnedAtById.get(row.id) ?? null
    return {
      ...row,
      tier: normalizeTierLabel(row.tier),
      buildable: row.buildable === 'yellow' ? 'yellow' : 'green',
      earned: earned_at != null,
      earned_at,
      imageUrl: achievementBadgeImageSrc(row.id),
    }
  })

  const earned = achievements.filter((badge) => badge.earned)
  const totalXp = earned.reduce((sum, badge) => sum + (badge.xp_value ?? 0), 0)

  const recentlyUnlocked = [...earned]
    .sort((a, b) => {
      const aTime = a.earned_at ? Date.parse(a.earned_at) : 0
      const bTime = b.earned_at ? Date.parse(b.earned_at) : 0
      return bTime - aTime
    })
    .slice(0, 2)

  return {
    achievements,
    groups: groupByCategory(achievements),
    totalXp,
    earnedCount: earned.length,
    totalCount: achievements.length,
    level: xpToLevel(totalXp),
    recentlyUnlocked,
    newlyAwardedIds: [],
    error: null,
  }
}
