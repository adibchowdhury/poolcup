import type { SupabaseClient } from '@supabase/supabase-js'
import { xpToLevel, type XpLevel } from '@/src/lib/levels'

/** Shared placeholder until real badge art lands. */
export const ACHIEVEMENT_PLACEHOLDER_IMAGE = '/badges/placeholder-badge.svg'

export type AchievementBuildable = 'green' | 'yellow'

export type AchievementCatalogueRow = {
  id: string
  name: string
  description: string
  category: string
  condition_metric: string
  threshold: number
  tier: string
  xp_value: number
  buildable: AchievementBuildable
  sort_order: number
}

export type AchievementWithStatus = AchievementCatalogueRow & {
  earned: boolean
  earned_at: string | null
  imageUrl: string
}

export type AchievementCategoryGroup = {
  category: string
  badges: AchievementWithStatus[]
}

export type UserAchievementProgress = {
  achievement_id: string
  name: string
  description: string
  category: string
  tier: string
  xp_value: number
  buildable: AchievementBuildable
  condition_metric: string
  threshold: number
  current_value: number
  earned: boolean
  progress_pct: number
}

export type UserAchievementsData = {
  achievements: AchievementWithStatus[]
  groups: AchievementCategoryGroup[]
  totalXp: number
  earnedCount: number
  totalCount: number
  level: XpLevel
  recentlyUnlocked: AchievementWithStatus[]
  newlyAwardedIds: string[]
  error: string | null
}

type UserAchievementRow = {
  achievement_id: string
  earned_at: string
}

function emptyData(error: string | null = null): UserAchievementsData {
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

function groupByCategory(
  achievements: AchievementWithStatus[],
): AchievementCategoryGroup[] {
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

/**
 * Evaluate (award newly-earned GREEN badges), then load catalogue + earned
 * rows for the signed-in user. Safe to call on every achievements view.
 */
export async function fetchUserAchievements(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserAchievementsData> {
  if (!userId) return emptyData('Not signed in.')

  const { data: newlyAwardedRaw, error: evalError } = await supabase.rpc(
    'evaluate_user_achievements',
    { p_user_id: userId },
  )

  if (evalError) {
    console.error('evaluate_user_achievements failed:', evalError.message)
  }

  const newlyAwardedIds = Array.isArray(newlyAwardedRaw)
    ? newlyAwardedRaw.map(String)
    : []

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
    return emptyData(catalogueRes.error.message)
  }
  if (earnedRes.error) {
    return emptyData(earnedRes.error.message)
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
      imageUrl: ACHIEVEMENT_PLACEHOLDER_IMAGE,
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
    newlyAwardedIds,
    error: evalError
      ? `Could not refresh awards: ${evalError.message}`
      : null,
  }
}

/** Real metric progress for profile achievement cards and career highlights. */
export async function fetchUserAchievementProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserAchievementProgress[]> {
  if (!userId) return []

  const { data, error } = await supabase.rpc(
    'get_user_achievement_progress',
    { p_user_id: userId },
  )

  if (error) {
    console.error('get_user_achievement_progress failed:', error.message)
    return []
  }

  return ((data ?? []) as UserAchievementProgress[]).map((row) => ({
    ...row,
    threshold: Math.max(0, Number(row.threshold) || 0),
    current_value: Math.max(0, Number(row.current_value) || 0),
    progress_pct: Math.min(100, Math.max(0, Number(row.progress_pct) || 0)),
  }))
}
