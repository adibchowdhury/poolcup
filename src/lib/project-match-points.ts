import { isKnockoutRound, type KnockoutRoundId } from '@/src/lib/classic-round-tab-logic'
import { KNOCKOUT_ROUND_POINT_VALUES } from '@/src/lib/knockout-match-prediction'
import type { PredictionOutcomeKind } from '@/src/lib/prediction-scoring'

export const GROUP_STAGE_POINTS = {
  exact: 5,
  draw: 3,
  winner: 2,
} as const

export type ProjectedMatchPointsBreakdown = {
  exact: number
  draw: number
  winner: number
  advance: number
}

export type ProjectedMatchPoints = {
  points: number
  breakdown: ProjectedMatchPointsBreakdown
  kind: PredictionOutcomeKind
}

function matchWinner(
  score1: number,
  score2: number,
): 'team1' | 'team2' | 'draw' {
  if (score1 > score2) return 'team1'
  if (score2 > score1) return 'team2'
  return 'draw'
}

function groupStageProjection(
  predTeam1: number,
  predTeam2: number,
  scoreTeam1: number,
  scoreTeam2: number,
): ProjectedMatchPoints {
  const predictedWinner = matchWinner(predTeam1, predTeam2)
  const actualWinner = matchWinner(scoreTeam1, scoreTeam2)
  const isExact = predTeam1 === scoreTeam1 && predTeam2 === scoreTeam2

  const breakdown: ProjectedMatchPointsBreakdown = {
    exact: 0,
    draw: 0,
    winner: 0,
    advance: 0,
  }

  if (isExact) {
    breakdown.exact = GROUP_STAGE_POINTS.exact
    return {
      points: GROUP_STAGE_POINTS.exact,
      breakdown,
      kind: 'exact',
    }
  }

  if (predictedWinner === 'draw' && actualWinner === 'draw') {
    breakdown.draw = GROUP_STAGE_POINTS.draw
    return {
      points: GROUP_STAGE_POINTS.draw,
      breakdown,
      kind: 'draw',
    }
  }

  if (predictedWinner === actualWinner && predictedWinner !== 'draw') {
    breakdown.winner = GROUP_STAGE_POINTS.winner
    return {
      points: GROUP_STAGE_POINTS.winner,
      breakdown,
      kind: 'winner',
    }
  }

  return { points: 0, breakdown, kind: 'wrong' }
}

function knockoutProjection(
  round: KnockoutRoundId,
  predTeam1: number,
  predTeam2: number,
  advancePick: number | null,
  scoreTeam1: number,
  scoreTeam2: number,
  advancingTeam: number | null,
): ProjectedMatchPoints {
  const values = KNOCKOUT_ROUND_POINT_VALUES[round]
  const breakdown: ProjectedMatchPointsBreakdown = {
    exact: 0,
    draw: 0,
    winner: 0,
    advance: 0,
  }

  const isExact = predTeam1 === scoreTeam1 && predTeam2 === scoreTeam2
  if (isExact) {
    breakdown.exact = values.exact
  }

  if (
    advancingTeam != null &&
    advancePick != null &&
    advancePick === advancingTeam
  ) {
    breakdown.advance = values.advance
  }

  const points = breakdown.exact + breakdown.advance

  let kind: PredictionOutcomeKind = 'wrong'
  if (breakdown.exact > 0) {
    kind = 'exact'
  } else if (breakdown.advance > 0) {
    kind = 'winner'
  }

  return { points, breakdown, kind }
}

export function projectMatchPoints(
  round: string,
  predTeam1: number,
  predTeam2: number,
  advancePick: number | null,
  scoreTeam1: number,
  scoreTeam2: number,
  advancingTeam: number | null,
): ProjectedMatchPoints {
  if (isKnockoutRound(round)) {
    return knockoutProjection(
      round,
      predTeam1,
      predTeam2,
      advancePick,
      scoreTeam1,
      scoreTeam2,
      advancingTeam,
    )
  }

  return groupStageProjection(predTeam1, predTeam2, scoreTeam1, scoreTeam2)
}

export function formatLivePointsSummary(
  round: string,
  predTeam1: number,
  predTeam2: number,
  advancePick: number | null,
  scoreTeam1: number,
  scoreTeam2: number,
  advancingTeam: number | null,
): string {
  const current = projectMatchPoints(
    round,
    predTeam1,
    predTeam2,
    advancePick,
    scoreTeam1,
    scoreTeam2,
    advancingTeam,
  )
  const suffix = current.points === 1 ? 'pt' : 'pts'
  return `${current.points} ${suffix} so far · +${current.points} if it ends ${scoreTeam1}–${scoreTeam2}`
}

export function getScoringRulesLines(round: string): string[] {
  if (isKnockoutRound(round)) {
    const values = KNOCKOUT_ROUND_POINT_VALUES[round]
    return [
      `Exact score: +${values.exact} points`,
      `Correct who advances: +${values.advance} points`,
      'Both stack when applicable.',
    ]
  }

  return [
    `Exact score: ${GROUP_STAGE_POINTS.exact} points`,
    `Correct draw: ${GROUP_STAGE_POINTS.draw} points`,
    `Correct winner: ${GROUP_STAGE_POINTS.winner} points`,
    'Single highest rule applies (no stacking).',
  ]
}
