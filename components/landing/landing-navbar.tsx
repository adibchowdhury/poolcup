'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { PoolCupLogo } from '@/components/poolcup-logo'
import {
  LANDING_GET_STARTED_HREF,
  LANDING_SIGN_IN_HREF,
} from '@/components/landing/landing-launch-ctas'
import {
  landingSignInOutlineClass,
  landingTactilePointerDown,
  landingTactilePrimaryClass,
} from '@/components/landing/landing-tactile-classes'
import { cn } from '@/lib/utils'

type LandingNavbarProps = {
  className?: string
  style?: React.CSSProperties
}

export function LandingNavbar({ className, style }: LandingNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [menuOpen, closeMenu])

  return (
    <>
      <nav
        className={cn(
          'relative z-50 mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4',
          className,
        )}
        style={style}
      >
        <PoolCupLogo onClick={closeMenu} />

        <div className="flex items-center justify-end gap-3">
          <div className="hidden items-center gap-4 md:flex">
            <Link
              href={LANDING_SIGN_IN_HREF}
              className={cn(
                landingSignInOutlineClass,
                'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0f]',
              )}
            >
              Sign in
            </Link>
            <Link
              href={LANDING_GET_STARTED_HREF}
              onPointerDown={landingTactilePointerDown}
              className={cn(
                landingTactilePrimaryClass,
                'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0f]',
              )}
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.12)] text-[#f0f4f8] transition-colors hover:bg-[rgba(255,255,255,0.05)] md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            <span className="relative block h-4 w-5" aria-hidden>
              <span
                className={cn(
                  'absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300',
                  menuOpen ? 'top-2 rotate-45' : 'top-0',
                )}
              />
              <span
                className={cn(
                  'absolute left-0 top-2 block h-0.5 w-5 rounded-full bg-current transition-all duration-300',
                  menuOpen ? 'opacity-0' : 'opacity-100',
                )}
              />
              <span
                className={cn(
                  'absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300',
                  menuOpen ? 'top-2 -rotate-45' : 'top-4',
                )}
              />
            </span>
          </button>
        </div>
      </nav>

      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden',
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className={cn(
            'absolute inset-0 bg-[#080b0f]/60 backdrop-blur-sm transition-opacity duration-300',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={closeMenu}
          tabIndex={menuOpen ? 0 : -1}
          aria-label="Close menu"
        />

        <div
          id="mobile-nav-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className={cn(
            'absolute inset-x-0 top-0 box-border flex min-h-full w-full max-w-[100vw] flex-col overflow-x-hidden bg-[#0d1520] px-6 pb-10 pt-[4.5rem] transition-transform duration-300 ease-out',
            menuOpen ? 'translate-y-0' : '-translate-y-full',
          )}
        >
          <nav className="flex w-full min-w-0 flex-col gap-4">
            <Link
              href={LANDING_GET_STARTED_HREF}
              onClick={closeMenu}
              onPointerDown={landingTactilePointerDown}
              className={cn(
                landingTactilePrimaryClass,
                'box-border w-full max-w-full rounded-lg px-4 py-3.5 text-center text-sm font-semibold',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1520]',
              )}
            >
              Get Started
            </Link>
            <Link
              href={LANDING_SIGN_IN_HREF}
              onClick={closeMenu}
              className={cn(
                landingSignInOutlineClass,
                'box-border w-full max-w-full rounded-lg px-4 py-3.5 text-center text-sm font-semibold',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1520]',
              )}
            >
              Sign in
            </Link>
          </nav>
        </div>
      </div>
    </>
  )
}
