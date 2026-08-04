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
