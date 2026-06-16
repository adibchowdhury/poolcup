export const CLASSIC_MATCH_TOTAL_FALLBACK = 48

export function hasClassicPredictionScores(
  score1: string,
  score2: string,
): boolean {
  return score1 !== '' && score2 !== ''
}

export function countClassicPredictedScores(
  entries: ReadonlyArray<{ score1: string; score2: string }>,
): number {
  return entries.filter((entry) =>
    hasClassicPredictionScores(entry.score1, entry.score2),
  ).length
}

export function classicMatchTotalCount(matchCount: number): number {
  return matchCount || CLASSIC_MATCH_TOTAL_FALLBACK
}
