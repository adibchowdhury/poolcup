/** Display labels aligned with predict-page round tabs (winner-only-round-tabs). */
export const TOURNAMENT_ROUND_LABELS = {
  group: 'Group Stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarterfinals',
  sf: 'Semifinals',
  third: '3rd Place Playoff',
  final: 'Final',
} as const

export type TournamentRoundCode = keyof typeof TOURNAMENT_ROUND_LABELS

export function tournamentRoundLabel(round: string): string {
  return (
    TOURNAMENT_ROUND_LABELS[round as TournamentRoundCode] ?? 'Group Stage'
  )
}

type MatchStageInput = {
  round: string
  kickoff_at: string
  is_final: boolean
}

/** Earliest non-final match by kickoff defines the stage in progress. */
export function deriveCurrentTournamentStage(
  matches: MatchStageInput[],
): string {
  if (matches.length === 0) {
    return TOURNAMENT_ROUND_LABELS.group
  }

  const earliestOpen = matches
    .filter((match) => !match.is_final)
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
    )[0]

  if (earliestOpen) {
    return tournamentRoundLabel(earliestOpen.round)
  }

  return 'Tournament complete'
}
