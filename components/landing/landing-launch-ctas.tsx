import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Matches landing match-preview / pricing signup convention. */
export const LANDING_GET_STARTED_HREF = '/login?next=/create'
export const LANDING_SIGN_IN_HREF = '/login'

type LandingLaunchCtasProps = {
  /** Larger primary for hero / final CTA; compact for denser layouts. */
  size?: 'hero' | 'section'
  className?: string
  align?: 'center' | 'start'
}

/**
 * Launched-mode CTA pair for the marketing landing page.
 * Primary: Get Started → create flow. Secondary: Sign in.
 */
export function LandingLaunchCtas({
  size = 'hero',
  className,
  align = 'center',
}: LandingLaunchCtasProps) {
  const isHero = size === 'hero'

  return (
    <div
      className={cn(
        'flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center',
        align === 'center' ? 'sm:justify-center' : 'sm:justify-start',
        className,
      )}
    >
      <Link
        href={LANDING_GET_STARTED_HREF}
        className={cn(
          'inline-flex items-center justify-center rounded-lg bg-[#00e676] font-semibold text-[#080b0f] transition-all',
          'hover:scale-[1.02] hover:bg-[#00e676]/90 hover:shadow-[0_0_28px_rgba(0,230,118,0.35)] active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0f]',
          isHero
            ? 'min-h-12 px-8 text-base sm:min-w-[11.5rem]'
            : 'min-h-11 px-6 text-sm sm:min-w-[10.5rem]',
        )}
      >
        Get Started
      </Link>
      <Link
        href={LANDING_SIGN_IN_HREF}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium text-[#f0f4f8]/80 transition-colors',
          'hover:text-[#00e676]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0f]',
          isHero ? 'min-h-12 px-4 text-base' : 'min-h-11 px-4 text-sm',
        )}
      >
        Sign in
      </Link>
    </div>
  )
}
