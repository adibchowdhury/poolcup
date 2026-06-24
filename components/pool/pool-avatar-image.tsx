import Image from 'next/image'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPoolAvatarSrc } from '@/src/lib/pool-avatars'

type PoolAvatarImageProps = {
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

export function PoolAvatarImage({
  avatar,
  size = 'md',
  className,
  imgClassName,
}: PoolAvatarImageProps) {
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
        <Image
          src={src}
          alt=""
          width={px}
          height={px}
          className={cn('size-full object-cover object-top', imgClassName)}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-muted/60 text-muted-foreground">
          <Shield className={cn(size === 'sm' ? 'h-5 w-5' : size === 'md' ? 'h-8 w-8' : 'h-12 w-12')} aria-hidden />
        </div>
      )}
    </div>
  )
}
