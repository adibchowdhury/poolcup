import Image from 'next/image'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPoolAvatarSrc } from '@/src/lib/pool-avatars'

type PoolAvatarImageProps = {
  /** Preset filename under /pool_avatars (legacy squad photo). */
  avatar: string | null | undefined
  /** Custom uploaded emblem URL — takes precedence when set. */
  emblemUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  /** Override pixel size (defaults from `size`). */
  pixelSize?: number
  className?: string
  imgClassName?: string
}

const SIZE_PX = {
  sm: 40,
  md: 72,
  lg: 112,
} as const

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('//')
}

export function PoolAvatarImage({
  avatar,
  emblemUrl,
  size = 'md',
  pixelSize,
  className,
  imgClassName,
}: PoolAvatarImageProps) {
  const px = pixelSize ?? SIZE_PX[size]
  const trimmedEmblem = emblemUrl?.trim() || null
  const presetSrc = getPoolAvatarSrc(avatar)
  const remoteEmblem = trimmedEmblem && isRemoteUrl(trimmedEmblem)

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-2xl border border-border bg-muted/40',
        className,
      )}
      style={{ width: px, height: px }}
    >
      {remoteEmblem ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase public emblem URL
        <img
          src={trimmedEmblem}
          alt=""
          width={px}
          height={px}
          className={cn('size-full object-cover', imgClassName)}
        />
      ) : presetSrc ? (
        <Image
          src={presetSrc}
          alt=""
          width={px}
          height={px}
          className={cn('size-full object-cover object-top', imgClassName)}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-muted/60 text-muted-foreground">
          <Shield
            className={cn(
              size === 'sm' ? 'h-5 w-5' : size === 'md' ? 'h-8 w-8' : 'h-12 w-12',
            )}
            aria-hidden
          />
        </div>
      )}
    </div>
  )
}
