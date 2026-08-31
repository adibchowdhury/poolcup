import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import type { PoolHomeMeta } from '@/components/pool/pool-home-view'
import { classicMatchTotalCount } from '@/src/lib/classic-prediction-progress'
import { isMatchLocked } from '@/src/lib/match-lock'
import {
  hasStoredClassicMatchPrediction,
  isClassicPredictionComplete,
} from '@/src/lib/merge-classic-match-predictions'

export type PoolHomeLifecycle = 'pre-event' | 'active' | 'completed'

const TOURNAMENT_COMPLETE = 'Tournament complete'

export function getPoolHomeLifecycle(pool: PoolHomeMeta): PoolHomeLifecycle {
  if (pool.stage === TOURNAMENT_COMPLETE) return 'completed'
  if (
    pool.totalMatches > 0 &&
    pool.matchesPlayed >= pool.totalMatches
  ) {
    return 'completed'
  }
  if (pool.matchesPlayed === 0) return 'pre-event'
  return 'active'
}

/** Next match that matters for picks — unpicked open first, then any open, then earliest upcoming. */
export function findNextUpMatch(
  predictions: UserPoolPrediction[],
): UserPoolPrediction | null {
  const upcoming = predictions
    .filter((p) => !p.isFinal)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
    )

  if (upcoming.length === 0) return null

  const unpickedOpen = upcoming.find(
    (p) =>
      !isMatchLocked(p.lockedAt) && !isClassicPredictionComplete(p),
  )
  if (unpickedOpen) return unpickedOpen

  const openForPicks = upcoming.find((p) => !isMatchLocked(p.lockedAt))
  if (openForPicks) return openForPicks

  return upcoming[0]
}

export function countRemainingPredictions(
  predictions: UserPoolPrediction[],
): number {
  return predictions.filter(
    (p) =>
      !p.isFinal &&
      !isMatchLocked(p.lockedAt) &&
      !isClassicPredictionComplete(p),
  ).length
}

export function countCompletedPredictions(
  predictions: UserPoolPrediction[],
): number {
  return predictions.filter((p) => isClassicPredictionComplete(p)).length
}

export function getClassicPredictionProgress(
  predictions: UserPoolPrediction[],
  totalMatchCount: number,
): { completed: number; total: number; remaining: number } | null {
  const total = classicMatchTotalCount(totalMatchCount)
  if (total <= 0) return null

  const completed = countCompletedPredictions(predictions)
  const remaining = Math.max(0, total - completed)

  return { completed, total, remaining }
}

export function getRecentResultMatches(
  predictions: UserPoolPrediction[],
  limit = 4,
): UserPoolPrediction[] {
  return predictions
    .filter(
      (p) =>
        p.isFinal &&
        p.resultTeam1 != null &&
        p.resultTeam2 != null &&
        hasStoredClassicMatchPrediction(p),
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    )
    .slice(0, limit)
}

/** Latest completed match with a recorded result (for tournament-complete hero). */
export function getLastFinalMatch(
  predictions: UserPoolPrediction[],
): UserPoolPrediction | null {
  const finals = predictions
    .filter(
      (p) =>
        p.isFinal &&
        p.resultTeam1 != null &&
        p.resultTeam2 != null,
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    )
  return finals[0] ?? null
}

/** Rank-1 member from leaderboard standings. */
export function getPoolChampion(
  members: ReadonlyArray<{ rank: number } & Record<string, unknown>>,
): (typeof members)[number] | null {
  if (members.length === 0) return null
  const byRank = members
    .slice()
    .sort((a, b) => a.rank - b.rank)
  return byRank.find((m) => m.rank === 1) ?? byRank[0] ?? null
}

/** Upcoming fixtures after the focal match (excluded), earliest kickoff first. */
export function getUpcomingMatchesAfter(
  predictions: UserPoolPrediction[],
  excludeMatchId: string | null,
  limit = 3,
): UserPoolPrediction[] {
  const upcoming = predictions
    .filter((p) => !p.isFinal)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
    )

  const afterExclude = excludeMatchId
    ? upcoming.filter((p) => p.matchId !== excludeMatchId)
    : upcoming

  return afterExclude.slice(0, limit)
}
