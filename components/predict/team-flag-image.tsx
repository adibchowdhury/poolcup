'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  countryNameToFlagSrc,
  hasFlagImage,
  resolveTeamFlagDisplay,
} from '@/src/lib/team-flags'
import { isTeamLogoUrl } from '@/src/lib/team-logos'

interface TeamFlagImageProps {
  countryName: string
  dbFlag?: string | null
  /** Club crest URL from matches.team*_logo (API-Football). */
  logoUrl?: string | null
  imgClassName?: string
  emojiClassName?: string
}

export function TeamFlagImage({
  countryName,
  dbFlag = null,
  logoUrl = null,
  imgClassName = 'h-6 w-auto shrink-0',
  emojiClassName = 'text-xl leading-none',
}: TeamFlagImageProps) {
  const crestSrc = isTeamLogoUrl(logoUrl) ? logoUrl!.trim() : null
  const flagSrc = countryNameToFlagSrc(countryName)
  const [crestFailed, setCrestFailed] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const showFlagImage = hasFlagImage(countryName)

  useEffect(() => {
    setCrestFailed(false)
  }, [crestSrc])

  useEffect(() => {
    setImageFailed(false)
  }, [flagSrc, showFlagImage])

  if (crestSrc && !crestFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={crestSrc}
        alt=""
        className={cn('shrink-0 object-contain', imgClassName)}
        onError={() => setCrestFailed(true)}
      />
    )
  }

  if (!showFlagImage || imageFailed) {
    return (
      <span className={cn('shrink-0', emojiClassName)} aria-hidden>
        {resolveTeamFlagDisplay(countryName, dbFlag)}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagSrc}
      alt=""
      className={cn('shrink-0', imgClassName)}
      onError={() => setImageFailed(true)}
    />
  )
}
