/**
 * PoolCup player levels are derived from total achievement XP
 * (sum of xp_value across earned badges). Pool points are separate
 * and do not feed this curve.
 */
export const LEVEL_XP_THRESHOLDS = [
  0, 100, 300, 600, 1_000, 1_500, 2_200, 3_000, 4_000, 5_200, 6_600, 8_200,
  10_000, 12_000, 14_500, 17_500, 21_000, 25_000, 29_500, 34_500, 40_000,
  46_000, 52_500, 59_500, 67_000, 75_000,
] as const

export type XpLevel = {
  level: number
  currentLevelFloor: number
  nextLevelThreshold: number | null
  xpIntoLevel: number
  xpToNext: number
  progressPct: number
}

export function xpToLevel(totalXp: number): XpLevel {
  const xp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0))

  let thresholdIndex = 0
  for (let index = LEVEL_XP_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    if (xp >= LEVEL_XP_THRESHOLDS[index]!) {
      thresholdIndex = index
      break
    }
  }

  const currentLevelFloor = LEVEL_XP_THRESHOLDS[thresholdIndex]!
  const nextLevelThreshold = LEVEL_XP_THRESHOLDS[thresholdIndex + 1] ?? null
  const xpIntoLevel = xp - currentLevelFloor

  if (nextLevelThreshold == null) {
    return {
      level: thresholdIndex + 1,
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
    Math.max(0, Math.floor((xpIntoLevel / levelSpan) * 100)),
  )

  return {
    level: thresholdIndex + 1,
    currentLevelFloor,
    nextLevelThreshold,
    xpIntoLevel,
    xpToNext: nextLevelThreshold - xp,
    progressPct,
  }
}
