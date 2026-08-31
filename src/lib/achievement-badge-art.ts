/** Shared placeholder shield until per-badge art lands in /public/badges. */
export const ACHIEVEMENT_PLACEHOLDER_IMAGE = '/badges/placeholder-badge.svg'

/** Custom badge art extension under /public/badges. */
export const ACHIEVEMENT_BADGE_IMAGE_EXT = 'png'

/**
 * Filenames that actually exist under public/badges/ (keep in sync with folder).
 * Used to skip network 404s — resolve missing art to the placeholder immediately.
 */
export const AVAILABLE_BADGE_ART_FILES = [
  '01_welcome_badge.png',
  '02_first_steps_badge.png',
  '03_pool_party_badge.png',
  '04_pool_host_badge.png',
  '06_picture_perfect_badge.png',
  'badge_first_steps.png',
  'placeholder-badge.svg',
] as const

const AVAILABLE_BADGE_ART_SET = new Set<string>(AVAILABLE_BADGE_ART_FILES)

/**
 * Prefer DB `art_filename` (e.g. 01_welcome_badge.png), else legacy badge_<id>.png.
 * If the resolved file is not in AVAILABLE_BADGE_ART_FILES, return the placeholder
 * (avoids a round-trip 404). <img onError> still guards unexpected misses.
 */
export function achievementBadgeImageSrc(
  achievementId: string,
  artFilename?: string | null,
): string {
  const named = artFilename?.trim()
  let candidate: string | null = null
  if (named) {
    const safe = named.replace(/^\/+/, '').replace(/^badges\//i, '')
    if (/^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp|svg)$/i.test(safe)) {
      candidate = safe
    }
  }
  if (!candidate) {
    candidate = `badge_${achievementId}.${ACHIEVEMENT_BADGE_IMAGE_EXT}`
  }

  if (AVAILABLE_BADGE_ART_SET.has(candidate)) {
    return `/badges/${candidate}`
  }

  return ACHIEVEMENT_PLACEHOLDER_IMAGE
}
