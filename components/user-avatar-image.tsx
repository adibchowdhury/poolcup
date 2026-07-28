'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  getUserAvatarSrc,
  type UserAvatarFields,
} from '@/src/lib/avatars'

type UserAvatarImageProps = UserAvatarFields & {
  className?: string
  imgClassName?: string
  alt?: string
}

/** Always shows a resolved user avatar (custom → preset → DEFAULT). Never initials. */
export function UserAvatarImage({
  customAvatarUrl,
  avatar,
  className,
  imgClassName,
  alt = '',
}: UserAvatarImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const preferred = getUserAvatarSrc({ customAvatarUrl, avatar })
  const src =
    failedSrc === preferred
      ? getUserAvatarSrc({ customAvatarUrl: null, avatar: null })
      : preferred

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn('size-full object-cover object-center', imgClassName)}
        onError={() => setFailedSrc(preferred)}
      />
    </div>
  )
}
