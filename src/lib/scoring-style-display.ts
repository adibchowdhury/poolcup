export const POOL_SCORING_STYLE_OPTIONS = [
  {
    id: 'classic' as const,
    label: 'Score Predictor',
    /** Short line on create-step cards and review. */
    tagline: 'Predict the score of every match.',
    /** Card bullets on the Choose Pool Type step. */
    highlights: [
      'Earn points for exact scores and correct outcomes',
      'Climb the pool leaderboard match by match',
      'Best for groups who follow along all season',
    ],
    /** Detailed scoring shown on Rules & Create. */
    rules: [
      'Predict the exact final score of each match',
      'Exact score: 5 points',
      'Correct draw (not the exact score): 3 points',
      'Correct winner, wrong score: 2 points',
      'Wrong outcome: 0 points',
    ],
  },
  {
    id: 'winner' as const,
    label: 'Winner Only',
    tagline: 'Just pick who wins each match.',
    highlights: [
      'One tap per match — home, away, or draw where allowed',
      'Earn points for each correct winner pick',
      'No scorelines — quick picks for casual groups',
    ],
    rules: [
      'Pick the winner of each match (or a draw in soccer/hockey leagues)',
      'Correct winner: uses your pool’s winner points setting',
      'Wrong outcome: 0 points',
      'Knockout rounds: pick who advances (no draw option)',
    ],
  },
] as const

export type PoolScoringStyleId = (typeof POOL_SCORING_STYLE_OPTIONS)[number]['id']

/** UI label for a pool scoring_style DB value. DB values are unchanged. */
export function formatScoringStyleLabel(style: string): string {
  switch (style) {
    case 'winner':
      return 'Winner Only'
    case 'classic':
    case 'exact':
      return 'Score Predictor'
    default:
      return style
  }
}
