'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * DESIGN PLACEHOLDERS ONLY - not backed by real schedules or navigation.
 * One mock event per sport in the dashboard sport-bubbles row, plus "All".
 */
const PLACEHOLDER_EVENT_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'wc', label: 'FIFA World Cup 2026' },
  { id: 'nba', label: 'NBA Finals' },
  { id: 'nfl', label: 'Super Bowl LX' },
  { id: 'nhl', label: 'Stanley Cup Final' },
  { id: 'mlb', label: 'World Series' },
  { id: 'cricket', label: 'Cricket World Cup' },
  { id: 'tennis', label: 'Wimbledon' },
  { id: 'volleyball', label: 'VNL Finals' },
  { id: 'ufc', label: 'UFC 320' },
] as const

type EventPillId = (typeof PLACEHOLDER_EVENT_PILLS)[number]['id']

/**
 * Horizontal event filter pills under the sport-bubbles row.
 * Selection is visual only - does not filter content yet.
 */
export function EventPillsRow({ className }: { className?: string }) {
  const [selectedEventId, setSelectedEventId] =
    useState<EventPillId>('all')

  return (
    <div
      className={cn(
        '-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      role="list"
      aria-label="Sporting events"
    >
      <div className="inline-flex min-w-full items-center gap-2 whitespace-nowrap sm:gap-2.5">
        {PLACEHOLDER_EVENT_PILLS.map((pill) => {
          const selected = pill.id === selectedEventId

          return (
            <button
              key={pill.id}
              type="button"
              role="listitem"
              aria-pressed={selected}
              onClick={() => setSelectedEventId(pill.id)}
              className={cn(
                'inline-flex shrink-0 cursor-pointer select-none items-center rounded-full',
                'border px-3.5 py-1.5 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                selected
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border/70 bg-transparent font-normal text-muted-foreground hover:border-border hover:text-foreground/80',
              )}
            >
              {pill.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
