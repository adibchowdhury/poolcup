/**
 * Map sporting_events.sport → /public/sports/*.png filename.
 * Shared by Matches tab and profile “Sports You Follow”.
 */
export function sportIconPng(sport: string): string | null {
  const normalized = sport.trim().toLowerCase()
  if (normalized === 'soccer' || normalized === 'football') return 'soccer.png'
  if (normalized === 'basketball') return 'basketball.png'
  if (normalized === 'american_football' || normalized === 'nfl') {
    return 'football.png'
  }
  if (normalized === 'hockey' || normalized === 'nhl') return 'hockey.png'
  if (normalized === 'baseball' || normalized === 'mlb') return 'baseball.png'
  if (normalized === 'cricket') return 'cricket.png'
  if (normalized === 'tennis') return 'tennis.png'
  if (normalized === 'volleyball') return 'volleyball.png'
  return null
}

/** Human label for a sport key from sporting_events.sport. */
export function sportDisplayLabel(sport: string): string {
  const normalized = sport.trim().toLowerCase()
  if (normalized === 'soccer' || normalized === 'football') return 'Football'
  if (normalized === 'american_football' || normalized === 'nfl') {
    return 'American Football'
  }
  if (normalized === 'hockey' || normalized === 'nhl') return 'Hockey'
  if (normalized === 'baseball' || normalized === 'mlb') return 'Baseball'
  if (normalized === 'basketball') return 'Basketball'
  if (normalized === 'cricket') return 'Cricket'
  if (normalized === 'tennis') return 'Tennis'
  if (normalized === 'volleyball') return 'Volleyball'
  if (!normalized) return 'Sport'
  return normalized
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Normalize sport keys so soccer/football collapse to one bucket. */
export function normalizeSportKey(sport: string): string {
  const normalized = sport.trim().toLowerCase()
  if (normalized === 'soccer' || normalized === 'football') return 'football'
  if (normalized === 'american_football' || normalized === 'nfl') {
    return 'american_football'
  }
  if (normalized === 'hockey' || normalized === 'nhl') return 'hockey'
  if (normalized === 'baseball' || normalized === 'mlb') return 'baseball'
  return normalized || 'football'
}
