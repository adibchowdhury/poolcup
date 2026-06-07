'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { SupportUsButton } from '@/components/support-us-button'
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
        <Link
          href="/"
          className="font-display text-2xl tracking-wider text-[#22c55e]"
          onClick={closeMenu}
        >
          POOLCUP
        </Link>

        <div className="flex items-center justify-end gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <SupportUsButton />
            <Link
              href="/login"
              className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#080b0f] transition-all hover:bg-[#22c55e]/90 hover:shadow-[0_0_24px_rgba(34,197,94,0.35)] active:scale-95"
            >
              Sign in
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
            'absolute inset-x-0 top-0 flex min-h-full flex-col items-center bg-[#0d1520] px-6 pb-10 pt-24 transition-transform duration-300 ease-out',
            menuOpen ? 'translate-y-0' : '-translate-y-full',
          )}
        >
          <nav className="flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
            <div className="flex w-full flex-col gap-3">
              <SupportUsButton fullWidth />
              <Link
                href="/login"
                onClick={closeMenu}
                className="w-full rounded-lg bg-[#22c55e] px-4 py-3.5 text-center text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#22c55e]/90"
              >
                Sign in
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
