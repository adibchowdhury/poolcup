/** Shared placeholder shield until per-badge art lands in /public/badges. */
export const ACHIEVEMENT_PLACEHOLDER_IMAGE = '/badges/placeholder-badge.svg'

/** Custom badge art extension under /public/badges. */
export const ACHIEVEMENT_BADGE_IMAGE_EXT = 'png'

/**
 * Prefer DB `art_filename` (e.g. 01_welcome_badge.png), else legacy badge_<id>.png.
 * Missing files fall back to the placeholder via <img onError>.
 */
export function achievementBadgeImageSrc(
  achievementId: string,
  artFilename?: string | null,
): string {
  const named = artFilename?.trim()
  if (named) {
    const safe = named.replace(/^\/+/, '').replace(/^badges\//i, '')
    if (/^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp|svg)$/i.test(safe)) {
      return `/badges/${safe}`
    }
  }
  return `/badges/badge_${achievementId}.${ACHIEVEMENT_BADGE_IMAGE_EXT}`
}
