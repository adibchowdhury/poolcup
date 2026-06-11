'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  countryNameToFlagSrc,
  hasFlagImage,
  resolveTeamFlagDisplay,
} from '@/src/lib/team-flags'

interface TeamFlagImageProps {
  countryName: string
  dbFlag?: string | null
  imgClassName?: string
  emojiClassName?: string
}

export function TeamFlagImage({
  countryName,
  dbFlag = null,
  imgClassName = 'h-6 w-auto shrink-0',
  emojiClassName = 'text-xl leading-none',
}: TeamFlagImageProps) {
  const flagSrc = countryNameToFlagSrc(countryName)
  const [imageFailed, setImageFailed] = useState(false)
  const showFlagImage = hasFlagImage(countryName)

  useEffect(() => {
    setImageFailed(false)
  }, [flagSrc, showFlagImage])

  if (!showFlagImage || imageFailed) {
    return (
      <span className={cn('shrink-0', emojiClassName)} aria-hidden>
        {resolveTeamFlagDisplay(countryName, dbFlag)}
      </span>
    )
  }

  return (
    <img
      src={flagSrc}
      alt=""
      className={cn('shrink-0', imgClassName)}
      onError={() => setImageFailed(true)}
    />
  )
}
