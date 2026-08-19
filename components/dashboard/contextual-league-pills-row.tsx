'use client'

import { DASHBOARD_ALL_EVENT_ID } from '@/components/dashboard/event-pills-row'
import type { SportingEvent } from '@/src/lib/current-event'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

type ContextualLeaguePillsRowProps = {
  events: SportingEvent[]
  selectedEventId: string
  onSelectedEventIdChange: (eventId: string) => void
  className?: string
  size?: 'default' | 'lg'
  /** scroll = horizontal strip; wrap = centered multi-line grid. */
  layout?: 'scroll' | 'wrap'
}

/**
 * Desktop Matches tab — league/event pills.
 * Tap a pill to filter; tap again to clear (all leagues in current sport scope).
 */
export function ContextualLeaguePillsRow({
  events,
  selectedEventId,
  onSelectedEventIdChange,
  className,
  size = 'default',
  layout = 'scroll',
}: ContextualLeaguePillsRowProps) {
  const isLg = size === 'lg'
  const isWrap = layout === 'wrap'

  if (events.length === 0) {
    return (
      <p
        className={cn(
          'text-center text-muted-foreground',
          isLg ? 'text-sm' : 'text-xs',
          className,
        )}
      >
        No leagues available right now.
      </p>
    )
  }

  return (
    <div
      className={cn(
        isWrap
          ? 'flex w-full flex-wrap items-center justify-center gap-2'
          : cn(
              'min-w-0 max-w-full -mx-1 overflow-x-auto overscroll-x-contain px-1',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            ),
        className,
      )}
      role="list"
      aria-label="Leagues"
    >
      <div
        className={cn(
          isWrap
            ? 'flex flex-wrap items-center justify-center gap-2'
            : 'inline-flex min-w-full items-center gap-1.5 whitespace-nowrap',
        )}
      >
        {events.map((event) => {
          const selected = event.id === selectedEventId

          return (
            <button
              key={event.id}
              type="button"
              role="listitem"
              aria-pressed={selected}
              onClick={() =>
                onSelectedEventIdChange(
                  selected ? DASHBOARD_ALL_EVENT_ID : event.id,
                )
              }
              className={cn(
                'inline-flex shrink-0 cursor-pointer select-none items-center rounded-full',
                'border font-medium transition-colors',
                isLg
                  ? 'border px-3.5 py-1.5 text-sm'
                  : 'border px-2.5 py-1 text-xs',
                FOCUS_VISIBLE_RING,
                selected
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-[#292929] bg-[#171717] text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {event.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
