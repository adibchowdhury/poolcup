'use client'

import Link from 'next/link'
import { LANDING_SIGN_IN_HREF } from '@/components/landing/landing-launch-ctas'
import {
  landingSignInOutlineClass,
  landingTactilePointerDown,
  landingTactilePrimaryClass,
} from '@/components/landing/landing-tactile-classes'
import { useAuth } from '@/src/lib/auth-context'
import {
  NFL_PICK_EM_CREATE_HREF,
  NFL_PICK_EM_CREATE_LOGIN_HREF,
} from '@/src/lib/nfl-pick-em-links'
import { cn } from '@/lib/utils'

export {
  NFL_PICK_EM_CREATE_HREF,
  NFL_PICK_EM_CREATE_LOGIN_HREF,
} from '@/src/lib/nfl-pick-em-links'

/**
 * Hero + bottom CTAs for /nfl-pick-em — client island for tactile press + auth.
 * Logged-out: `/login?next=%2Fcreate%3Fevent%3Dnfl-2026` (query survives login).
 * Logged-in: `/create?event=nfl-2026` directly (landing convention destination).
 * Secondary: Sign in → `/login`.
 */
export function NflPickEmHeroCtas() {
  const { user } = useAuth()
  const primaryHref = user
    ? NFL_PICK_EM_CREATE_HREF
    : NFL_PICK_EM_CREATE_LOGIN_HREF

  return (
    <div className="mt-10 flex w-full flex-col items-stretch gap-3 pb-1.5 sm:flex-row sm:items-center sm:justify-center">
      <Link
        href={primaryHref}
        onPointerDown={landingTactilePointerDown}
        className={cn(
          landingTactilePrimaryClass,
          'inline-flex min-h-12 items-center justify-center rounded-lg px-8 text-base font-semibold sm:min-w-[11.5rem]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0f]',
        )}
      >
        Create Your NFL Pick&apos;em Pool
      </Link>
      <Link
        href={LANDING_SIGN_IN_HREF}
        className={cn(
          landingSignInOutlineClass,
          'inline-flex min-h-12 items-center justify-center rounded-lg px-8 text-base font-semibold sm:min-w-[11.5rem]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0f]',
        )}
      >
        Sign in
      </Link>
    </div>
  )
}
