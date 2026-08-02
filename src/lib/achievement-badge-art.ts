/** Shared placeholder shield until per-badge art lands in /public/badges. */
export const ACHIEVEMENT_PLACEHOLDER_IMAGE = '/badges/placeholder-badge.svg'

/** Custom badge art extension under /public/badges. */
export const ACHIEVEMENT_BADGE_IMAGE_EXT = 'png'

/**
 * Id-based custom art path: badge_<achievement_id>.png
 * Missing files fall back to the placeholder via <img onError>.
 */
export function achievementBadgeImageSrc(achievementId: string): string {
  return `/badges/badge_${achievementId}.${ACHIEVEMENT_BADGE_IMAGE_EXT}`
}
