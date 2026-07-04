import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPoolAvatarSrc } from '@/src/lib/pool-avatars'

type MobilePoolAvatarImageProps = {
  avatar: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
  imgClassName?: string
}

const SIZE_PX = {
  sm: 40,
  md: 72,
  lg: 112,
} as const

export function MobilePoolAvatarImage({
  avatar,
  size = 'md',
  className,
  imgClassName,
}: MobilePoolAvatarImageProps) {
  const px = SIZE_PX[size]
  const src = getPoolAvatarSrc(avatar)

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-2xl border border-border bg-muted/40',
        className,
      )}
      style={{ width: px, height: px }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
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
