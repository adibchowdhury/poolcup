'use client'

import { useState } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  resolveCurrentUserAvatarSrc,
  type CurrentUserAvatarFields,
} from '../lib/resolve-current-user-avatar'

type CurrentUserAvatarSize = 'sm' | 'md' | 'lg' | 'hero'

const sizeClassByVariant: Record<CurrentUserAvatarSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-24 w-24',
  hero: 'h-48 w-48',
}

const iconClassByVariant: Record<CurrentUserAvatarSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
  hero: 'h-14 w-14',
}

type CurrentUserAvatarProps = CurrentUserAvatarFields & {
  size?: CurrentUserAvatarSize
  className?: string
  imgClassName?: string
}

export function CurrentUserAvatar({
  custom_avatar_url,
  avatar,
  size = 'sm',
  className,
  imgClassName,
}: CurrentUserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const src = resolveCurrentUserAvatarSrc({ custom_avatar_url, avatar })
  const showImage = Boolean(src) && !imageFailed
  const isPresetOnly =
    !custom_avatar_url?.trim() && Boolean(avatar?.trim()) && showImage

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40',
        sizeClassByVariant[size],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          className={cn(
            'h-full w-full',
            isPresetOnly && size === 'hero'
              ? 'object-contain object-bottom p-2'
              : 'object-cover',
            imgClassName,
          )}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <User
          className={cn(
            iconClassByVariant[size],
            'text-muted-foreground/50',
          )}
          aria-hidden
        />
      )}
    </div>
  )
}
