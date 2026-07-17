export type PredictionOutcomeKind = 'exact' | 'draw' | 'winner' | 'wrong'

export type MatchScoringStyle = 'classic' | 'winner'

export type PredictionOutcome = {
  points: number
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

export function normalizeMatchScoringStyle(scoringStyle: string): MatchScoringStyle {
  return scoringStyle === 'winner' ? 'winner' : 'classic'
}

export function getPredictionOutcome(
  predTeam1: number,
  predTeam2: number,
  resultTeam1: number,
  resultTeam2: number,
  scoringStyle: MatchScoringStyle = 'classic',
): PredictionOutcome {
  const predictedWinner = matchWinner(predTeam1, predTeam2)
  const actualWinner = matchWinner(resultTeam1, resultTeam2)
  const isExact = predTeam1 === resultTeam1 && predTeam2 === resultTeam2

  if (scoringStyle === 'classic') {
    if (isExact) {
      return { points: 5, kind: 'exact' }
    }

    if (predictedWinner === 'draw' && actualWinner === 'draw') {
      return { points: 3, kind: 'draw' }
    }

    if (predictedWinner === actualWinner && predictedWinner !== 'draw') {
      return { points: 2, kind: 'winner' }
    }

    return { points: 0, kind: 'wrong' }
  }

  if (predictedWinner === 'draw' && actualWinner === 'draw') {
    return { points: 3, kind: 'draw' }
  }

  if (
    (predTeam1 > predTeam2 && resultTeam1 > resultTeam2) ||
    (predTeam1 < predTeam2 && resultTeam1 < resultTeam2)
  ) {
    return { points: 2, kind: 'winner' }
  }

  return { points: 0, kind: 'wrong' }
}

export function getMatchRoundPointMultiplier(round: string): number {
  switch (round) {
    case 'r16':
      return 2
    case 'qf':
      return 3
    case 'sf':
      return 4
    case 'third':
      return 4
    case 'final':
      return 5
    default:
      return 1
  }
}

export function getPredictionOutcomeLabel(kind: PredictionOutcomeKind): string {
  switch (kind) {
    case 'exact':
      return 'Exact score'
    case 'draw':
      return 'Correct draw'
    case 'winner':
      return 'Correct winner'
    case 'wrong':
      return 'Wrong'
  }
}
