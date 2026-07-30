/**
 * Shared horizon for UPCOMING match listings on the website.
 * Cap is a FUTURE window only — live and past/completed matches are unaffected.
 *
 * Tunable in one place: change UPCOMING_HORIZON_DAYS to adjust all list surfaces.
 */
export const UPCOMING_HORIZON_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getUpcomingHorizonEndMs(nowMs: number = Date.now()): number {
  return nowMs + UPCOMING_HORIZON_DAYS * MS_PER_DAY
}

export function getUpcomingHorizonEndIso(nowMs: number = Date.now()): string {
  return new Date(getUpcomingHorizonEndMs(nowMs)).toISOString()
}

/**
 * True when kickoff is in the future and within the upcoming list window
 * (now, now + UPCOMING_HORIZON_DAYS].
 *
 * Past and "now" kickoffs return false — those belong to live/recent lists,
 * not upcoming listings.
 */
export function isWithinUpcomingHorizon(
  kickoffAt: string | Date,
  nowMs: number = Date.now(),
): boolean {
  const kickoffMs = new Date(kickoffAt).getTime()
  if (!Number.isFinite(kickoffMs)) return false
  return kickoffMs > nowMs && kickoffMs <= getUpcomingHorizonEndMs(nowMs)
}

/**
 * True when kickoff is more than UPCOMING_HORIZON_DAYS ahead of now.
 * Use to drop far-future rows from upcoming lists only.
 */
export function isBeyondUpcomingHorizon(
  kickoffAt: string | Date,
  nowMs: number = Date.now(),
): boolean {
  const kickoffMs = new Date(kickoffAt).getTime()
  if (!Number.isFinite(kickoffMs)) return false
  return kickoffMs > getUpcomingHorizonEndMs(nowMs)
}
