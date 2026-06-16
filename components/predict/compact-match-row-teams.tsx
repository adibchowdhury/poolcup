'use client'

import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'

export function CompactMatchRowTeamHome({
  name,
  dbFlag,
  variant = 'compact',
}: {
  name: string
  dbFlag?: string | null
  variant?: 'compact' | 'prominent'
}) {
  const prominent = variant === 'prominent'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-1',
        'sm:flex-row sm:items-center sm:gap-2',
      )}
    >
      <TeamFlagImage
        countryName={name}
        dbFlag={dbFlag}
        imgClassName={cn(
          'w-auto shrink-0 object-cover',
          prominent ? 'h-6 sm:h-7' : 'h-5 sm:h-6',
        )}
        emojiClassName={cn('leading-none', prominent ? 'text-lg sm:text-xl' : 'text-base sm:text-lg')}
      />
      <span
        className={cn(
          'w-full text-center font-semibold text-foreground',
          prominent ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
          'sm:min-w-0 sm:flex-1 sm:text-left sm:leading-snug',
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
  variant = 'compact',
}: {
  name: string
  dbFlag?: string | null
  variant?: 'compact' | 'prominent'
}) {
  const prominent = variant === 'prominent'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-1',
        'sm:flex-row sm:items-center sm:justify-end sm:gap-2',
      )}
    >
      <TeamFlagImage
        countryName={name}
        dbFlag={dbFlag}
        imgClassName={cn(
          'w-auto shrink-0 object-cover sm:order-2',
          prominent ? 'h-6 sm:h-7' : 'h-5 sm:h-6',
        )}
        emojiClassName={cn('leading-none', prominent ? 'text-lg sm:text-xl' : 'text-base sm:text-lg')}
      />
      <span
        className={cn(
          'w-full text-center font-semibold text-foreground',
          prominent ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
          'sm:order-1 sm:min-w-0 sm:flex-1 sm:text-right sm:leading-snug',
        )}
      >
        {name}
      </span>
    </div>
  )
}
