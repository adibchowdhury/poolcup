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
 * All ball PNGs in public/sports/, plus UFC (no ball image → icon).
 * Order: World Cup / soccer first, then major US leagues, then remaining, UFC last.
 */
export const SPORT_BUBBLES: SportBubble[] = [
  { id: 'wc', label: 'Futbol', iconPng: 'soccer.png' },
  { id: 'nba', label: 'NBA', iconPng: 'basketball.png' },
  { id: 'nfl', label: 'NFL', iconPng: 'football.png' },
  { id: 'nhl', label: 'NHL', iconPng: 'hockey.png' },
  { id: 'mlb', label: 'MLB', iconPng: 'baseball.png' },
  { id: 'cricket', label: 'Cricket', iconPng: 'cricket.png' },
  { id: 'tennis', label: 'Tennis', iconPng: 'tennis.png' },
  { id: 'volleyball', label: 'Volleyball', iconPng: 'volleyball.png' },
  { id: 'ufc', label: 'UFC', iconPng: null },
]

/** Map bubble id → normalizeSportKey bucket for sporting_events.sport. */
const SPORT_BUBBLE_KEY: Record<string, string> = {
  wc: 'football',
  nba: 'basketball',
  nfl: 'american_football',
  nhl: 'hockey',
  mlb: 'baseball',
  cricket: 'cricket',
  tennis: 'tennis',
  volleyball: 'volleyball',
  ufc: 'ufc',
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

/** 56px */
const BALL_SIZE = 'h-14 w-14'

function SportBubbleItem({
  sport,
  selected,
  onSelect,
}: {
  sport: SportBubble
  selected: boolean
  onSelect: () => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const showIcon = !sport.iconPng || imgFailed

  return (
    <button
      type="button"
      role="listitem"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex w-16 shrink-0 cursor-pointer flex-col items-center gap-0.5',
        'select-none sm:w-[4.5rem]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      {showIcon ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-full',
            'border bg-card/70',
            BALL_SIZE,
            selected
              ? 'border-primary shadow-[0_0_16px_color-mix(in_srgb,var(--primary)_35%,transparent)]'
              : 'border-border/70',
          )}
        >
          <Swords
            className={cn(
              'h-6 w-6',
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
          width={56}
          height={56}
          className={cn(
            BALL_SIZE,
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
          'w-full truncate text-center text-[10px] font-medium leading-none sm:text-[11px]',
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
}

/** Story-style sport bubbles — single-select, tap again to deselect (all sports). */
export function SportBubblesRow({
  className,
  selectedSportId,
  onSelectedSportIdChange,
}: SportBubblesRowProps) {
  return (
    <div
      className={cn(
        'min-w-0 max-w-full -mx-1 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      role="list"
      aria-label="Sports"
    >
      <div className="flex w-full min-w-0 items-start justify-start gap-2.5 sm:justify-between sm:gap-2 md:justify-center md:gap-5">
        {SPORT_BUBBLES.map((sport) => {
          const selected = sport.id === selectedSportId
          return (
            <SportBubbleItem
              key={sport.id}
              sport={sport}
              selected={selected}
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
