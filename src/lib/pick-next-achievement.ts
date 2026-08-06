import type { UserAchievementProgress } from '@/src/lib/fetch-user-achievements'

/**
 * Pick the in-progress achievement closest to unlock
 * (highest progress %, then fewest remaining).
 */
export function pickNextAchievement(
  rows: UserAchievementProgress[],
): UserAchievementProgress | null {
  const candidates = rows.filter(
    (row) => !row.earned && row.threshold > 0 && row.progress_pct < 100,
  )
  if (candidates.length === 0) return null

  return [...candidates].sort((a, b) => {
    if (b.progress_pct !== a.progress_pct) return b.progress_pct - a.progress_pct
    const aRemain = Math.max(0, a.threshold - a.current_value)
    const bRemain = Math.max(0, b.threshold - b.current_value)
    return aRemain - bRemain
  })[0]!
}
