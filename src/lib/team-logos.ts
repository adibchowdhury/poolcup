/**
 * Shared helpers for API-Football team crest URLs stored on matches.
 */
export function isTeamLogoUrl(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  return /^https?:\/\//i.test(trimmed)
}

export function normalizeTeamLogoUrl(
  value: string | null | undefined,
): string | null {
  if (!isTeamLogoUrl(value)) return null
  return value!.trim()
}

/**
 * Parse API-Football team id from crest URLs like:
 *   https://media.api-sports.io/football/teams/42.png
 * Returns null when the URL is missing or doesn't match.
 */
export function parseTeamApiIdFromLogoUrl(
  logoUrl: string | null | undefined,
): number | null {
  if (!logoUrl) return null
  const trimmed = logoUrl.trim()
  if (!trimmed) return null

  const match = trimmed.match(/\/football\/teams\/(\d+)(?:\.\w+)?(?:\?.*)?$/i)
  if (!match?.[1]) return null

  const id = Number.parseInt(match[1], 10)
  return Number.isFinite(id) && id > 0 ? id : null
}
