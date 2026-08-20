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
    /**
     * Truthful to WinnerOnlyPredictView: group finishing order + best
     * third-place ranking, then knockout advance picks (not per-match scores).
     */
    tagline: 'Rank group standings and pick who advances.',
    highlights: [
      'Rank all four teams in each group (1st through 4th)',
      'Pick the eight best third-place teams',
      'Knockouts: pick who advances — no scorelines',
    ],
    rules: [
      'Rank all four teams in each group (1st through 4th)',
      'Rank the eight best third-place teams',
      'Points awarded after each group finishes playing',
      'Knockouts: pick who advances (no scorelines)',
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
