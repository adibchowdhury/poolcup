export type MatchPredictionDistribution = {
  total: number
  outcomes: {
    team1_win: number
    draw: number
    team2_win: number
  }
  top_scores: Array<{ team1: number; team2: number; count: number }>
}

export function parseMatchPredictionDistribution(
  data: unknown,
): MatchPredictionDistribution | null {
  if (!data || typeof data !== 'object') return null

  const row = data as Record<string, unknown>
  const outcomesRaw = row.outcomes
  const topScoresRaw = row.top_scores

  if (!outcomesRaw || typeof outcomesRaw !== 'object') return null

  const outcomes = outcomesRaw as Record<string, unknown>

  return {
    total: typeof row.total === 'number' ? row.total : 0,
    outcomes: {
      team1_win: typeof outcomes.team1_win === 'number' ? outcomes.team1_win : 0,
      draw: typeof outcomes.draw === 'number' ? outcomes.draw : 0,
      team2_win: typeof outcomes.team2_win === 'number' ? outcomes.team2_win : 0,
    },
    top_scores: Array.isArray(topScoresRaw)
      ? topScoresRaw
          .map((item) => {
            if (!item || typeof item !== 'object') return null
            const score = item as Record<string, unknown>
            if (
              typeof score.team1 !== 'number' ||
              typeof score.team2 !== 'number' ||
              typeof score.count !== 'number'
            ) {
              return null
            }
            return {
              team1: score.team1,
              team2: score.team2,
              count: score.count,
            }
          })
          .filter(
            (item): item is { team1: number; team2: number; count: number } =>
              item != null,
          )
      : [],
  }
}
