/**
 * PoolCup player levels are derived from the xp_transactions ledger total
 * (actions + achievements). Matches live SQL:
 *   xp_for_level(L) = 50*(L-1)^2 + 50*(L-1)
 *   level_from_xp(xp) = floor((50 + sqrt(2500 + 200*xp)) / 100) clamped 1..50
 *
 * Pool points (users.points / points_transactions) are a separate currency
 * and do not feed this curve.
 */

export const MAX_XP_LEVEL = 50
const LEVEL_COEFF = 50

export type XpLevel = {
  level: number
  currentLevelFloor: number
  nextLevelThreshold: number | null
  xpIntoLevel: number
  xpToNext: number
  progressPct: number
}

/** Cumulative XP required to *reach* `level` (level 1 = 0). */
export function xpForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_XP_LEVEL, Math.floor(level)))
  const n = clamped - 1
  return LEVEL_COEFF * n * n + LEVEL_COEFF * n
}

/** Current level for a ledger XP total. Matches public.level_from_xp. */
export function levelFromXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0))
  const raw = Math.floor((50 + Math.sqrt(50 * 50 + 4 * 50 * xp)) / (2 * 50))
  return Math.max(1, Math.min(MAX_XP_LEVEL, raw))
}

export function xpToLevel(totalXp: number): XpLevel {
  const xp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0))
  const level = levelFromXp(xp)
  const currentLevelFloor = xpForLevel(level)
  const nextLevelThreshold =
    level >= MAX_XP_LEVEL ? null : xpForLevel(level + 1)
  const xpIntoLevel = xp - currentLevelFloor

  if (nextLevelThreshold == null) {
    return {
      level,
      currentLevelFloor,
      nextLevelThreshold,
      xpIntoLevel,
      xpToNext: 0,
      progressPct: 100,
    }
  }

  const levelSpan = nextLevelThreshold - currentLevelFloor
  const progressPct = Math.min(
    99,
    Math.max(0, Math.floor((xpIntoLevel / Math.max(levelSpan, 1)) * 100)),
  )

  return {
    level,
    currentLevelFloor,
    nextLevelThreshold,
    xpIntoLevel,
    xpToNext: nextLevelThreshold - xp,
    progressPct,
  }
}

/** @deprecated Use xpForLevel / xpToLevel. Kept as a 50-length floor table. */
export const LEVEL_XP_THRESHOLDS: readonly number[] = Array.from(
  { length: MAX_XP_LEVEL },
  (_, index) => xpForLevel(index + 1),
)
