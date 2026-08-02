'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ACHIEVEMENT_PLACEHOLDER_IMAGE,
  achievementBadgeImageSrc,
} from '@/src/lib/achievement-badge-art'

type AchievementBadgeArtProps = {
  achievementId: string
  alt?: string
  className?: string
}

/**
 * Loads /badges/badge_<id>.png; on missing/failed load, falls back to the
 * placeholder shield. Adding new files under public/badges auto-picks them up.
 */
export function AchievementBadgeArt({
  achievementId,
  alt = '',
  className,
}: AchievementBadgeArtProps) {
  const [src, setSrc] = useState(() => achievementBadgeImageSrc(achievementId))

  useEffect(() => {
    setSrc(achievementBadgeImageSrc(achievementId))
  }, [achievementId])

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
