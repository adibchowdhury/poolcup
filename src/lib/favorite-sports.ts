/**
 * Onboarding sport ids (`users.favorite_sports`) → dashboard sport bubble ids.
 * Bubble ids must stay in sync with SPORT_BUBBLES in sport-bubbles-row.tsx.
 */
export const ONBOARDING_SPORT_TO_BUBBLE: Record<string, string> = {
  soccer: 'wc',
  basketball: 'nba',
  football: 'nfl',
  hockey: 'nhl',
  baseball: 'mlb',
  cricket: 'cricket',
}

const BUBBLE_IDS = new Set([
  'wc',
  'nba',
  'nfl',
  'nhl',
  'mlb',
  'cricket',
  'tennis',
  'volleyball',
  'ufc',
])

/**
 * Default sport bubble for the dashboard filter.
 * First mappable favorite wins (UI is single-select). Empty favorites → null (all sports).
 * Deselecting a bubble still clears to null (all sports) via SportBubblesRow.
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
