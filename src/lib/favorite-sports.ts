/**
 * Map onboarding sport ids (`users.favorite_sports`) → dashboard sport bubble ids.
 * Bubble ids must stay in sync with SPORT_BUBBLES in sport-bubbles-row.tsx.
 * Used for profile chips and analytics — not for auto-selecting the home filter.
 */
export const ONBOARDING_SPORT_TO_BUBBLE: Record<string, string> = {
  soccer: 'wc',
  basketball: 'nba',
  football: 'nfl',
  hockey: 'nhl',
  baseball: 'mlb',
}

const BUBBLE_IDS = new Set(['wc', 'nba', 'nfl', 'nhl', 'mlb'])

/**
 * First mappable favorite → bubble id (for analytics/profile). Does not drive filter UI.
 * Empty favorites → null.
 */
export function defaultSportBubbleFromFavorites(
  favorites: string[] | null | undefined,
): string | null {
  if (!favorites?.length) return null

  for (const raw of favorites) {
    const id = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    if (!id) continue
    const bubbleId =
      ONBOARDING_SPORT_TO_BUBBLE[id] ?? (BUBBLE_IDS.has(id) ? id : null)
    if (bubbleId && BUBBLE_IDS.has(bubbleId)) return bubbleId
  }

  return null
}
