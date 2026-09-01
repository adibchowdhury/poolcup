'use client'

import Link from 'next/link'
import {
  landingSignInOutlineClass,
  landingTactilePointerDown,
  landingTactilePrimaryClass,
} from '@/components/landing/landing-tactile-classes'
import { NFL_PICK_EM_PAGE_HREF } from '@/src/lib/college-football-pick-em-links'
import { cn } from '@/lib/utils'

/**
 * Hero + bottom CTAs for /college-football-pick-em — interim launching state.
 *
 * Phase 3 seam: replace the primary `<a href="#launching">` with auth-aware
 * create links from college-football-pick-em-links.ts (same pattern as NFL).
 *   logged-out → CFB_PICK_EM_CREATE_LOGIN_HREF
 *   logged-in  → CFB_PICK_EM_CREATE_HREF
 */
export function CollegeFootballPickEmHeroCtas() {
  return (
    <div className="mt-10 flex w-full flex-col items-stretch gap-3 pb-1.5 sm:flex-row sm:items-center sm:justify-center">
      <a
        href="#launching"
        onPointerDown={landingTactilePointerDown}
        className={cn(
          landingTactilePrimaryClass,
          'inline-flex min-h-12 items-center justify-center rounded-lg px-8 text-base font-semibold sm:min-w-[11.5rem]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0f]',
        )}
      >
        College Football Pick&apos;em — Launching This Week
      </a>
      <Link
        href={NFL_PICK_EM_PAGE_HREF}
        className={cn(
          landingSignInOutlineClass,
          'inline-flex min-h-12 items-center justify-center rounded-lg px-8 text-base font-semibold sm:min-w-[11.5rem]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0f]',
        )}
      >
        Play NFL Pick&apos;em now
      </Link>
    </div>
  )
}
