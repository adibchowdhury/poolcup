import type { SupabaseClient } from '@supabase/supabase-js'
import { achievementBadgeImageSrc } from '@/src/lib/achievement-badge-art'
import { xpToLevel, type XpLevel } from '@/src/lib/levels'
import { fetchUserXpTotal } from '@/src/lib/xp'

export { ACHIEVEMENT_PLACEHOLDER_IMAGE } from '@/src/lib/achievement-badge-art'

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
  list_order: number | null
  art_filename: string | null
  is_active: boolean
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
  /** Catalogue browse: active 60 + any retired badges this user earned. */
  groups: AchievementCategoryGroup[]
  totalXp: number
  earnedCount: number
  /** Active catalogue size (canonical 60), not including retired-only rows. */
  totalCount: number
  level: XpLevel
  recentlyUnlocked: AchievementWithStatus[]
  newlyAwardedIds: string[]
  error: string | null
  evalXpAwarded: number
  evalLevelBefore: number | null
  evalLevelAfter: number | null
}

type UserAchievementRow = {
  achievement_id: string
  earned_at: string
}

const ACHIEVEMENT_SELECT =
  'id, name, description, category, condition_metric, threshold, tier, xp_value, buildable, sort_order, list_order, art_filename, is_active'

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
    evalXpAwarded: 0,
    evalLevelBefore: null,
    evalLevelAfter: null,
  }
}

function normalizeTierLabel(tier: string | null | undefined): string {
  const value = (tier ?? '').trim()
  if (!value || value === '—' || value === '-') return ''
  return value
}

function displayOrder(badge: AchievementWithStatus): number {
  if (badge.list_order != null) return badge.list_order
  return badge.sort_order + 10_000
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
    badges: [...(map.get(category) ?? [])].sort(
      (a, b) => displayOrder(a) - displayOrder(b),
    ),
  }))
}

function mapCatalogueRows(
  catalogue: AchievementCatalogueRow[],
  earnedAtById: Map<string, string>,
): AchievementWithStatus[] {
  return catalogue.map((row) => {
    const earned_at = earnedAtById.get(row.id) ?? null
    return {
      ...row,
      tier: normalizeTierLabel(row.tier),
      buildable: row.buildable === 'yellow' ? 'yellow' : 'green',
      is_active: row.is_active !== false,
      list_order: row.list_order ?? null,
      art_filename: row.art_filename ?? null,
      earned: earned_at != null,
      earned_at,
      imageUrl: achievementBadgeImageSrc(row.id, row.art_filename),
    }
  })
}

/**
 * Catalogue + earned shelf:
 * - Active badges always included (the canonical 60).
 * - Retired (is_active=false) included only if this user earned them.
 */
export function visibleAchievementsForUser(
  all: AchievementWithStatus[],
): AchievementWithStatus[] {
  return all
    .filter((badge) => badge.is_active || badge.earned)
    .sort((a, b) => displayOrder(a) - displayOrder(b))
}

function buildAchievementsData(
  catalogue: AchievementCatalogueRow[],
  earnedRows: UserAchievementRow[],
  newlyAwardedIds: string[],
  evalError: string | null,
  ledgerXp: number,
  evalMeta?: {
    evalXpAwarded: number
    evalLevelBefore: number | null
    evalLevelAfter: number | null
  },
): UserAchievementsData {
  const earnedAtById = new Map(
    earnedRows.map((row) => [row.achievement_id, row.earned_at] as const),
  )

  const all = mapCatalogueRows(catalogue, earnedAtById)
  const visible = visibleAchievementsForUser(all)
  const earned = all.filter((badge) => badge.earned)
  const activeCount = all.filter((badge) => badge.is_active).length

  const recentlyUnlocked = [...earned]
    .sort((a, b) => {
      const aTime = a.earned_at ? Date.parse(a.earned_at) : 0
      const bTime = b.earned_at ? Date.parse(b.earned_at) : 0
      return bTime - aTime
    })
    .slice(0, 2)

  return {
    achievements: visible,
    groups: groupByCategory(visible),
    totalXp: ledgerXp,
    earnedCount: earned.length,
    totalCount: activeCount,
    level: xpToLevel(ledgerXp),
    recentlyUnlocked,
    newlyAwardedIds,
    error: evalError,
    evalXpAwarded: evalMeta?.evalXpAwarded ?? 0,
    evalLevelBefore: evalMeta?.evalLevelBefore ?? null,
    evalLevelAfter: evalMeta?.evalLevelAfter ?? null,
  }
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

  let newlyAwardedIds: string[] = []
  let evalError: string | null = null
  let evalMeta = {
    evalXpAwarded: 0,
    evalLevelBefore: null as number | null,
    evalLevelAfter: null as number | null,
  }

  if (typeof window !== 'undefined') {
    const { requestXpEvaluate } = await import('@/src/lib/xp-client')
    const evaluated = await requestXpEvaluate()
    if (evaluated?.error && !evaluated.newlyAwardedIds?.length) {
      evalError = `Could not refresh awards: ${evaluated.error}`
    } else if (evaluated) {
      newlyAwardedIds = evaluated.newlyAwardedIds ?? []
      evalMeta = {
        evalXpAwarded: evaluated.xpAwarded ?? 0,
        evalLevelBefore: evaluated.levelBefore ?? null,
        evalLevelAfter: evaluated.levelAfter ?? null,
      }
    }
  }

  const [catalogueRes, earnedRes, ledgerXp] = await Promise.all([
    supabase
      .from('achievements')
      .select(ACHIEVEMENT_SELECT)
      .order('sort_order', { ascending: true }),
    supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', userId),
    fetchUserXpTotal(supabase, userId),
  ])

  if (catalogueRes.error) {
    return emptyData(catalogueRes.error.message)
  }
  if (earnedRes.error) {
    return emptyData(earnedRes.error.message)
  }

  return buildAchievementsData(
    (catalogueRes.data ?? []) as AchievementCatalogueRow[],
    (earnedRes.data ?? []) as UserAchievementRow[],
    newlyAwardedIds,
    evalError,
    ledgerXp,
    evalMeta,
  )
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

export { buildAchievementsData, mapCatalogueRows, ACHIEVEMENT_SELECT }
