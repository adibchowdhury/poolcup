'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ACHIEVEMENT_PLACEHOLDER_IMAGE,
  achievementBadgeImageSrc,
} from '@/src/lib/achievement-badge-art'

type AchievementBadgeArtProps = {
  achievementId: string
  /** DB art_filename when present (e.g. 01_welcome_badge.png). */
  artFilename?: string | null
  /** Precomputed URL from fetch helpers; preferred when set. */
  src?: string | null
  alt?: string
  className?: string
}

/**
 * Loads badge art from art_filename / badge_<id>.png; on missing/failed load,
 * falls back to the placeholder shield.
 */
export function AchievementBadgeArt({
  achievementId,
  artFilename = null,
  src: srcProp = null,
  alt = '',
  className,
}: AchievementBadgeArtProps) {
  const preferred =
    srcProp?.trim() ||
    achievementBadgeImageSrc(achievementId, artFilename)
  const [src, setSrc] = useState(preferred)

  useEffect(() => {
    setSrc(preferred)
  }, [preferred])

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local public assets with onError fallback
    <img
      src={src}
      alt={alt}
      width={160}
      height={160}
      className={cn(
        'block h-full w-full max-h-full max-w-full object-contain',
        className,
      )}
      style={{ width: '100%', height: '100%' }}
      loading="lazy"
      decoding="async"
      onError={() => {
        setSrc((current) =>
          current === ACHIEVEMENT_PLACEHOLDER_IMAGE
            ? current
            : ACHIEVEMENT_PLACEHOLDER_IMAGE,
        )
      }}
    />
  )
}
