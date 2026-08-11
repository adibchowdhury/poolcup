'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { hrefForUser } from '@/src/lib/user-profile-href'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

type UserProfileLinkProps = {
  userId: string
  /** Prefer vanity URL when known. */
  username?: string | null
  className?: string
  children: ReactNode
  /** Accessible name when the child is only an avatar. */
  ariaLabel?: string
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Wraps name/avatar content in a link to `/u/[username]` or `/u/[userId]`.
 * Use only around identity chrome — not entire interactive rows.
 */
export function UserProfileLink({
  userId,
  username,
  className,
  children,
  ariaLabel,
  onClick,
}: UserProfileLinkProps) {
  if (!userId) return <>{children}</>

  return (
    <Link
      href={hrefForUser(userId, username)}
      className={cn(
        'min-w-0 rounded-sm outline-none transition-opacity hover:opacity-90',
        FOCUS_VISIBLE_RING,
        className,
      )}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}
