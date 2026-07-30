/**
 * PoolCup levels are derived directly from total points — there is no separate
 * XP currency. Tune this table as the scoring economy matures.
 */
export const LEVEL_POINT_THRESHOLDS = [
  0, 500, 1_500, 3_000, 5_000, 8_000, 12_000, 17_000, 23_000, 30_000,
  38_000, 47_000, 57_000, 68_000, 80_000,
] as const

export type PointsLevel = {
  level: number
  currentLevelFloor: number
  nextLevelThreshold: number | null
  pointsIntoLevel: number
  pointsToNext: number
  progressPct: number
}

export function pointsToLevel(totalPoints: number): PointsLevel {
  const points = Math.max(0, Math.floor(Number.isFinite(totalPoints) ? totalPoints : 0))

  let thresholdIndex = 0
  for (let index = LEVEL_POINT_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    if (points >= LEVEL_POINT_THRESHOLDS[index]!) {
      thresholdIndex = index
      break
    }
  }

  const currentLevelFloor = LEVEL_POINT_THRESHOLDS[thresholdIndex]!
  const nextLevelThreshold = LEVEL_POINT_THRESHOLDS[thresholdIndex + 1] ?? null
  const pointsIntoLevel = points - currentLevelFloor

  if (nextLevelThreshold == null) {
    return {
      level: thresholdIndex + 1,
      currentLevelFloor,
      nextLevelThreshold,
      pointsIntoLevel,
      pointsToNext: 0,
      progressPct: 100,
    }
  }

  const levelSpan = nextLevelThreshold - currentLevelFloor
  const progressPct = Math.min(
    99,
    Math.max(0, Math.floor((pointsIntoLevel / levelSpan) * 100)),
  )

  return {
    level: thresholdIndex + 1,
    currentLevelFloor,
    nextLevelThreshold,
    pointsIntoLevel,
    pointsToNext: nextLevelThreshold - points,
    progressPct,
  }
}
