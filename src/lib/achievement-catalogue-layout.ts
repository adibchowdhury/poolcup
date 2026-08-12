import type { AchievementWithStatus } from '@/src/lib/fetch-user-achievements'

/** Canonical display categories for the 60-badge catalogue (by list_order). */
export const ACHIEVEMENT_DISPLAY_CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', from: 1, to: 5 },
  { id: 'predictions', label: 'Predictions', from: 6, to: 13 },
  { id: 'streaks', label: 'Streaks', from: 14, to: 18 },
  { id: 'upsets', label: 'Upsets & Special Picks', from: 19, to: 24 },
  { id: 'pool', label: 'Pool Achievements', from: 25, to: 32 },
  { id: 'social', label: 'Social', from: 33, to: 39 },
  { id: 'multi-sport', label: 'Multi-Sport', from: 40, to: 47 },
  { id: 'milestones', label: 'Milestones', from: 48, to: 53 },
  { id: 'rare-fun', label: 'Rare / Fun', from: 54, to: 60 },
] as const

export type AchievementDisplayCategoryId =
  (typeof ACHIEVEMENT_DISPLAY_CATEGORIES)[number]['id']

export type AchievementUiState = 'earned' | 'locked' | 'coming_soon'

export type AchievementRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary'

export {
  achievementRarityLabel,
  ACHIEVEMENT_RARITY_STYLES,
  getAchievementRarityFromXp as getAchievementRarity,
  normalizeAchievementRarity,
  type AchievementRarityLabel,
} from '@/src/lib/achievement-rarity'

export function isComingSoonMetric(conditionMetric: string): boolean {
  return (
    conditionMetric === 'pending_batch2' ||
    conditionMetric === 'pending_multisport'
  )
}

export function getAchievementUiState(
  badge: AchievementWithStatus,
): AchievementUiState {
  if (badge.earned) return 'earned'
  if (isComingSoonMetric(badge.condition_metric)) return 'coming_soon'
  return 'locked'
}

export type AchievementDisplayGroup = {
  id: string
  label: string
  badges: AchievementWithStatus[]
  earnedCount: number
  totalCount: number
}

/**
 * Group active catalogue (+ earned retired) into display categories by list_order.
 * Retired earned badges (no list_order) go in a trailing "Legacy unlocks" section.
 */
export function groupAchievementsForDisplay(
  badges: AchievementWithStatus[],
): AchievementDisplayGroup[] {
  const byOrder = new Map<number, AchievementWithStatus>()
  const legacy: AchievementWithStatus[] = []

  for (const badge of badges) {
    if (badge.list_order != null && badge.list_order >= 1 && badge.list_order <= 60) {
      byOrder.set(badge.list_order, badge)
    } else if (badge.earned) {
      legacy.push(badge)
    }
  }

  const groups: AchievementDisplayGroup[] = ACHIEVEMENT_DISPLAY_CATEGORIES.map(
    (cat) => {
      const rows: AchievementWithStatus[] = []
      for (let n = cat.from; n <= cat.to; n += 1) {
        const badge = byOrder.get(n)
        if (badge) rows.push(badge)
      }
      return {
        id: cat.id,
        label: cat.label,
        badges: rows,
        earnedCount: rows.filter((b) => b.earned).length,
        totalCount: rows.length,
      }
    },
  ).filter((group) => group.badges.length > 0)

  if (legacy.length > 0) {
    legacy.sort((a, b) => {
      const aTime = a.earned_at ? Date.parse(a.earned_at) : 0
      const bTime = b.earned_at ? Date.parse(b.earned_at) : 0
      return bTime - aTime
    })
    groups.push({
      id: 'legacy',
      label: 'Legacy unlocks',
      badges: legacy,
      earnedCount: legacy.length,
      totalCount: legacy.length,
    })
  }

  return groups
}

export function formatAchievementEarnedDate(value: string | null): string {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
