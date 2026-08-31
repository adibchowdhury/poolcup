'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  getUserAvatarSrc,
  type UserAvatarFields,
} from '@/src/lib/avatars'
import {
  avatarColorClassForUser,
  initialsFromDisplayName,
} from '@/src/lib/pool-chat-helpers'

type UserAvatarImageProps = UserAvatarFields & {
  className?: string
  imgClassName?: string
  alt?: string
  /**
   * When set, empty/missing avatar sources and image load failures render
   * initials instead of the DEFAULT preset. Omit on shared callers so they
   * keep custom → preset → DEFAULT behavior.
   */
  fallbackInitials?: string | null
  /** Stable key for initials color hashing (defaults to fallbackInitials). */
  fallbackColorKey?: string | null
}

/** Resolved user avatar (custom → preset → DEFAULT), or initials when opted in. */
export function UserAvatarImage({
  customAvatarUrl,
  avatar,
  className,
  imgClassName,
  alt = '',
  fallbackInitials = null,
  fallbackColorKey = null,
}: UserAvatarImageProps) {
  const hasCustom = Boolean(customAvatarUrl?.trim())
  const hasPreset = Boolean(avatar?.trim())
  const initialsLabel = fallbackInitials?.trim() || null
  const useInitialsFallback = Boolean(initialsLabel)

  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    setFailedSrc(null)
    setImgFailed(false)
  }, [customAvatarUrl, avatar])

  if (useInitialsFallback && ((!hasCustom && !hasPreset) || imgFailed)) {
    return (
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-[0.65rem] font-semibold uppercase tracking-wide',
          avatarColorClassForUser(fallbackColorKey?.trim() || initialsLabel!),
          className,
        )}
        aria-label={alt || undefined}
      >
        <span aria-hidden>{initialsFromDisplayName(initialsLabel!)}</span>
      </div>
    )
  }

  const preferred = getUserAvatarSrc({ customAvatarUrl, avatar })
  const src =
    !useInitialsFallback && failedSrc === preferred
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
        onError={() => {
          if (useInitialsFallback) {
            setImgFailed(true)
            return
          }
          setFailedSrc(preferred)
        }}
      />
    </div>
  )
}
