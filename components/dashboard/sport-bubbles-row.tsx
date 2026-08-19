'use client'

import { useState } from 'react'
import { Swords } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeSportKey } from '@/src/lib/sport-display'

export type SportBubble = {
  id: string
  label: string
  /** Filename under /sports/ — null uses Lucide Swords fallback */
  iconPng: string | null
}

/**
 * Supported sport bubbles for the dashboard filter.
 * Order: soccer first, then major US leagues.
 */
export const SPORT_BUBBLES: SportBubble[] = [
  { id: 'wc', label: 'Futbol', iconPng: 'soccer.png' },
  { id: 'nba', label: 'NBA', iconPng: 'basketball.png' },
  { id: 'nfl', label: 'NFL', iconPng: 'football.png' },
  { id: 'nhl', label: 'NHL', iconPng: 'hockey.png' },
  { id: 'mlb', label: 'MLB', iconPng: 'baseball.png' },
]

/** Map bubble id → normalizeSportKey bucket for sporting_events.sport. */
const SPORT_BUBBLE_KEY: Record<string, string> = {
  wc: 'football',
  nba: 'basketball',
  nfl: 'american_football',
  nhl: 'hockey',
  mlb: 'baseball',
}

/** Resolve a sport bubble id to the normalized sport key used on events. */
export function sportBubbleNormalizedKey(sportId: string): string | null {
  return SPORT_BUBBLE_KEY[sportId] ?? null
}

/** Whether a sporting_events.sport value belongs to the selected bubble. */
export function eventMatchesSportBubble(
  eventSport: string,
  sportBubbleId: string,
): boolean {
  const key = sportBubbleNormalizedKey(sportBubbleId)
  if (!key) return false
  return normalizeSportKey(eventSport) === key
}

/** 56px default; 64px large (Matches tab desktop strip). */
const BALL_SIZE_CLASS = {
  default: 'h-14 w-14',
  lg: 'h-16 w-16',
} as const

const BALL_COLUMN_CLASS = {
  default: 'w-16 sm:w-[4.5rem]',
  lg: 'w-[4.75rem] sm:w-20',
} as const

function SportBubbleItem({
  sport,
  selected,
  onSelect,
  size = 'default',
}: {
  sport: SportBubble
  selected: boolean
  onSelect: () => void
  size?: 'default' | 'lg'
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const showIcon = !sport.iconPng || imgFailed
  const isLg = size === 'lg'

  return (
    <button
      type="button"
      role="listitem"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex shrink-0 cursor-pointer flex-col items-center gap-0.5 select-none',
        BALL_COLUMN_CLASS[size],
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      {showIcon ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-full',
            'border bg-card/70',
            BALL_SIZE_CLASS[size],
            selected
              ? 'border-primary shadow-[0_0_16px_color-mix(in_srgb,var(--primary)_35%,transparent)]'
              : 'border-border/70',
          )}
        >
          <Swords
            className={cn(
              isLg ? 'h-7 w-7' : 'h-6 w-6',
              selected ? 'text-primary' : 'text-foreground',
            )}
            aria-hidden
          />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/sports/${sport.iconPng}`}
          alt=""
          width={isLg ? 64 : 56}
          height={isLg ? 64 : 56}
          className={cn(
            BALL_SIZE_CLASS[size],
            'object-contain transition-[filter,opacity]',
            selected
              ? 'drop-shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_55%,transparent)]'
              : 'opacity-90',
          )}
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      )}
      <span
        className={cn(
          'w-full truncate text-center font-medium leading-none',
          isLg
            ? 'text-xs sm:text-sm'
            : 'text-[10px] sm:text-[11px]',
          selected ? 'font-semibold text-primary' : 'text-foreground',
        )}
      >
        {sport.label}
      </span>
    </button>
  )
}

type SportBubblesRowProps = {
  className?: string
  /** null = all sports (no bubble selected). */
  selectedSportId: string | null
  onSelectedSportIdChange: (sportId: string | null) => void
  size?: 'default' | 'lg'
  /** scroll = overflow strip; inline = flex row for centered desktop strip. */
  layout?: 'scroll' | 'inline'
}

/** Story-style sport bubbles — single-select, tap again to deselect (all sports). */
export function SportBubblesRow({
  className,
  selectedSportId,
  onSelectedSportIdChange,
  size = 'default',
  layout = 'scroll',
}: SportBubblesRowProps) {
  const isInline = layout === 'inline'
  const isLg = size === 'lg'

  return (
    <div
      className={cn(
        isInline
          ? 'min-w-0'
          : cn(
              'min-w-0 max-w-full -mx-1 overflow-x-auto overscroll-x-contain px-1',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            ),
        className,
      )}
      role="list"
      aria-label="Sports"
    >
      <div
        className={cn(
          'flex min-w-0 items-start',
          isInline
            ? cn('justify-center', isLg ? 'gap-3.5 sm:gap-4' : 'gap-2.5 sm:gap-3')
            : cn('w-full justify-start', isLg ? 'gap-3.5 sm:gap-4' : 'gap-2.5 sm:gap-3'),
        )}
      >
        {SPORT_BUBBLES.map((sport) => {
          const selected = sport.id === selectedSportId
          return (
            <SportBubbleItem
              key={sport.id}
              sport={sport}
              selected={selected}
              size={size}
              onSelect={() =>
                onSelectedSportIdChange(selected ? null : sport.id)
              }
            />
          )
        })}
      </div>
    </div>
  )
}
