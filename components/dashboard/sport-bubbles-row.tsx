'use client'

import { useState } from 'react'
import { Swords } from 'lucide-react'
import { cn } from '@/lib/utils'

type SportBubble = {
  id: string
  label: string
  /** Filename under /sports/ — null uses Lucide Swords fallback */
  iconPng: string | null
}

/**
 * All ball PNGs in public/sports/, plus UFC (no ball image → icon).
 * Order: World Cup first, then major US leagues, then remaining balls, UFC last.
 */
const SPORT_BUBBLES: SportBubble[] = [
  { id: 'wc', label: 'World Cup', iconPng: 'soccer.png' },
  { id: 'nba', label: 'NBA', iconPng: 'basketball.png' },
  { id: 'nfl', label: 'NFL', iconPng: 'football.png' },
  { id: 'nhl', label: 'NHL', iconPng: 'hockey.png' },
  { id: 'mlb', label: 'MLB', iconPng: 'baseball.png' },
  { id: 'cricket', label: 'Cricket', iconPng: 'cricket.png' },
  { id: 'tennis', label: 'Tennis', iconPng: 'tennis.png' },
  { id: 'volleyball', label: 'Volleyball', iconPng: 'volleyball.png' },
  { id: 'ufc', label: 'UFC', iconPng: null },
]

/** 48px */
const BALL_SIZE = 'h-12 w-12'

function SportBubbleItem({ sport }: { sport: SportBubble }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showIcon = !sport.iconPng || imgFailed

  return (
    <div
      className={cn(
        'flex w-14 shrink-0 cursor-pointer flex-col items-center gap-0.5',
        'select-none sm:w-16',
      )}
    >
      {showIcon ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-full',
            'border border-border/70 bg-card/70',
            BALL_SIZE,
          )}
        >
          <Swords className="h-5 w-5 text-foreground" aria-hidden />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/sports/${sport.iconPng}`}
          alt=""
          width={48}
          height={48}
          className={cn(BALL_SIZE, 'object-contain')}
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      )}
      <span className="w-full truncate text-center text-[9px] font-medium leading-none text-foreground sm:text-[10px]">
        {sport.label}
      </span>
    </div>
  )
}

/** Story-style sport bubbles under the dashboard header. Visual only — no tap behavior yet. */
export function SportBubblesRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        '-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      role="list"
      aria-label="Sports"
    >
      <div className="flex w-full min-w-0 items-start justify-start gap-2.5 sm:justify-between sm:gap-2 md:justify-center md:gap-5">
        {SPORT_BUBBLES.map((sport) => (
          <SportBubbleItem key={sport.id} sport={sport} />
        ))}
      </div>
    </div>
  )
}
