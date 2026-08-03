'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { hrefForUser } from '@/src/lib/user-profile-href'

type UserProfileLinkProps = {
  userId: string
  className?: string
  children: ReactNode
  /** Accessible name when the child is only an avatar. */
  ariaLabel?: string
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Wraps name/avatar content in a link to `/u/[userId]`.
 * Use only around identity chrome — not entire interactive rows.
 */
export function UserProfileLink({
  userId,
  className,
  children,
  ariaLabel,
  onClick,
}: UserProfileLinkProps) {
  if (!userId) return <>{children}</>

  return (
    <Link
      href={hrefForUser(userId)}
      className={cn(
        'min-w-0 rounded-sm outline-none transition-opacity hover:opacity-90',
        'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}
