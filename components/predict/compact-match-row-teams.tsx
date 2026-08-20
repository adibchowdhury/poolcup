'use client'

import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'

export function CompactMatchRowTeamHome({
  name,
  dbFlag,
  logoUrl,
  variant = 'compact',
  /** lg+: logo above name, larger crest (pool prediction cards). */
  desktopStacked = false,
  nameClassName,
  className,
}: {
  name: string
  dbFlag?: string | null
  logoUrl?: string | null
  variant?: 'compact' | 'prominent'
  desktopStacked?: boolean
  /** Optional name typography/overflow overrides. */
  nameClassName?: string
  className?: string
}) {
  const prominent = variant === 'prominent'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-1',
        'sm:flex-row sm:items-center sm:gap-2',
        desktopStacked && 'lg:flex-col lg:items-center lg:justify-center lg:gap-1.5',
        className,
      )}
    >
      <TeamFlagImage
        countryName={name}
        dbFlag={dbFlag}
        logoUrl={logoUrl}
        imgClassName={cn(
          'w-auto shrink-0 object-contain',
          prominent ? 'h-6 sm:h-7' : 'h-5 sm:h-6',
          // ~1.5× sm crest (h-6/h-7 → h-10)
          desktopStacked && 'lg:h-10',
        )}
        emojiClassName={cn(
          'leading-none',
          prominent ? 'text-lg sm:text-xl' : 'text-base sm:text-lg',
          desktopStacked && 'lg:text-3xl',
        )}
      />
      <span
        className={cn(
          'w-full text-center font-semibold text-foreground',
          prominent ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
          'sm:min-w-0 sm:flex-1 sm:text-left sm:leading-snug',
          desktopStacked && 'lg:w-full lg:flex-none lg:text-center',
          nameClassName,
        )}
      >
        {name}
      </span>
    </div>
  )
}

export function CompactMatchRowTeamAway({
  name,
  dbFlag,
  logoUrl,
  variant = 'compact',
  /** lg+: logo above name, larger crest (pool prediction cards). */
  desktopStacked = false,
  nameClassName,
  className,
}: {
  name: string
  dbFlag?: string | null
  logoUrl?: string | null
  variant?: 'compact' | 'prominent'
  desktopStacked?: boolean
  /** Optional name typography/overflow overrides. */
  nameClassName?: string
  className?: string
}) {
  const prominent = variant === 'prominent'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-1',
        'sm:flex-row sm:items-center sm:justify-end sm:gap-2',
        desktopStacked && 'lg:flex-col lg:items-center lg:justify-center lg:gap-1.5',
        className,
      )}
    >
      <TeamFlagImage
        countryName={name}
        dbFlag={dbFlag}
        logoUrl={logoUrl}
        imgClassName={cn(
          'w-auto shrink-0 object-contain sm:order-2',
          prominent ? 'h-6 sm:h-7' : 'h-5 sm:h-6',
          desktopStacked && 'lg:order-none lg:h-10',
        )}
        emojiClassName={cn(
          'leading-none',
          prominent ? 'text-lg sm:text-xl' : 'text-base sm:text-lg',
          // Emoji path has no order util on the span; wrap order via parent flex-col DOM order.
          desktopStacked && 'lg:order-none lg:text-3xl',
        )}
      />
      <span
        className={cn(
          'w-full text-center font-semibold text-foreground',
          prominent ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
          'sm:order-1 sm:min-w-0 sm:flex-1 sm:text-right sm:leading-snug',
          desktopStacked && 'lg:order-none lg:w-full lg:flex-none lg:text-center',
          nameClassName,
        )}
      >
        {name}
      </span>
    </div>
  )
}
