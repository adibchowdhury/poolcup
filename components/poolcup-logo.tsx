'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/src/lib/auth-context'
import { cn } from '@/lib/utils'

type PoolCupLogoProps = {
  className?: string
  linkClassName?: string
  onClick?: () => void
  /** Override link destination; defaults to /dashboard when signed in, / otherwise */
  href?: string
}

export function PoolCupLogo({
  className,
  linkClassName,
  onClick,
  href,
}: PoolCupLogoProps) {
  const { user, loading } = useAuth()
  const destination = href ?? (!loading && user ? '/dashboard' : '/')

  return (
    <Link
      href={destination}
      onClick={onClick}
      className={cn('inline-flex shrink-0', linkClassName)}
      aria-label="PoolCup home"
    >
      <Image
        src="/poolcup-logo.png"
        alt="PoolCup"
        width={140}
        height={48}
        className={cn('h-10 w-[116.67px] object-contain sm:h-12 sm:w-[140px]', className)}
        priority
      />
    </Link>
  )
}
