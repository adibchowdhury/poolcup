/**
 * Guards for live score sync / finalize cron paths. Prevents polling or finalizing
 * matches with placeholder fixture ids and implausibly early FT from the API.
 */

/** Real API-Football fixture ids are large; placeholders often equal match_number (1–104). */
export const MIN_API_FOOTBALL_FIXTURE_ID = 100_000

/** Minimum wall-clock minutes after kickoff before a match may be marked final. */
export const MIN_MINUTES_BEFORE_FINALIZE = 100

export type FixtureIdValidationOptions = {
  /** When set, reject ids that equal the row's match_number placeholder. */
  matchNumber?: number | null
}

export function isValidApiFootballFixtureId(
  fixtureId: string | null | undefined,
  options?: FixtureIdValidationOptions,
): boolean {
  if (fixtureId == null) return false

  const trimmed = fixtureId.trim()
  if (!trimmed) return false

  if (!/^\d+$/.test(trimmed)) return false

  const numericId = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(numericId) || numericId < MIN_API_FOOTBALL_FIXTURE_ID) {
    return false
  }

  if (
    options?.matchNumber != null &&
    Number.isFinite(options.matchNumber) &&
    numericId === options.matchNumber
  ) {
    return false
  }

  return true
}

export function minutesSinceKickoff(
  kickoffAt: string,
  nowMs: number = Date.now(),
): number {
  const kickoffMs = new Date(kickoffAt).getTime()
  if (Number.isNaN(kickoffMs)) return Number.NEGATIVE_INFINITY
  return (nowMs - kickoffMs) / 60_000
}

export function canFinalizeMatchByKickoff(
  kickoffAt: string,
  nowMs: number = Date.now(),
): boolean {
  return minutesSinceKickoff(kickoffAt, nowMs) >= MIN_MINUTES_BEFORE_FINALIZE
}

export function logUpdaterGuardWarning(
  source: string,
  message: string,
  context: Record<string, unknown>,
): void {
  console.warn(`[${source}] ${message}`, context)
}
