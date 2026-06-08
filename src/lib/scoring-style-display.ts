export const POOL_SCORING_STYLE_OPTIONS = [
  {
    id: 'winner' as const,
    label: 'Winner Only',
    tagline: 'Perfect for casual groups',
    rules: [
      'Pick which team wins each match',
      'Correct winner: 2 points',
      'Wrong prediction: 0 points',
    ],
  },
  {
    id: 'classic' as const,
    label: 'Score Predictor',
    tagline: 'Best of both worlds',
    rules: [
      'Predict the exact final score of each match',
      'Exact score: 5 points',
      'Correct winner but wrong score: 2 points',
      'Wrong prediction: 0 points',
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
