export type PoolScoringRow = {
  id: 'exact' | 'winner' | 'draw'
  label: string
  points: string
}

export const POOL_SCORING_STYLE_OPTIONS = [
  {
    id: 'classic' as const,
    label: 'Score Predictor',
    /** Primary line on create-step cards and review summary. */
    tagline: 'Predict the exact score',
    /** Secondary supporting line on create-step cards. */
    secondaryLine: 'Exact scores · More ways to earn points',
    /** Default points rows for desktop create-step scoring inset. */
    scoringRows: [
      { id: 'exact' as const, label: 'Exact score', points: '+5 pts' },
      { id: 'winner' as const, label: 'Correct winner', points: '+2 pts' },
      { id: 'draw' as const, label: 'Draw', points: '+3 pts' },
    ] satisfies PoolScoringRow[],
    /**
     * @deprecated Prefer tagline + secondaryLine on create cards.
     * Kept for any callers that still expect a bullet list.
     */
    highlights: [
      'Predict the exact score',
      'Exact scores · More ways to earn points',
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
    tagline: 'Just pick the winner',
    secondaryLine: 'Quick picks · Great for casual groups',
    scoringRows: [
      { id: 'winner' as const, label: 'Correct winner', points: '+2 pts' },
      { id: 'draw' as const, label: 'Draw', points: '+3 pts' },
    ] satisfies PoolScoringRow[],
    highlights: [
      'Just pick the winner',
      'Quick picks · Great for casual groups',
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
