'use client'

import { useState } from 'react'
import { EventPillsRow } from '@/components/dashboard/event-pills-row'
import { MyMatchesFilterChip } from '@/components/dashboard/my-matches-filter-chip'
import { SportBubblesRow } from '@/components/dashboard/sport-bubbles-row'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

/**
 * Dashboard sport bubbles + event pills with shared filter state.
 * Default: no sport selected (all sports). Tap a bubble to filter; tap again to clear.
 */
export function DashboardMatchFilters({
  className,
  sportRowClassName,
  hideMatchSlider = false,
  selectedSportId: controlledSportId,
  onSelectedSportIdChange,
  selectedEventId,
  onSelectedEventIdChange,
  myMatchesActive = false,
  onMyMatchesToggle,
}: {
  className?: string
  sportRowClassName?: string
  hideMatchSlider?: boolean
  selectedSportId?: string | null
  onSelectedSportIdChange?: (sportId: string | null) => void
  selectedEventId?: string
  onSelectedEventIdChange?: (eventId: string) => void
  /** When set, renders the My matches toggle chip above sport bubbles. */
  myMatchesActive?: boolean
  onMyMatchesToggle?: () => void
}) {
  const [internalSportId, setInternalSportId] = useState<string | null>(null)
  const selectedSportId = controlledSportId ?? internalSportId

  function handleSportChange(next: string | null) {
    if (onSelectedSportIdChange) {
      onSelectedSportIdChange(next)
    } else {
      setInternalSportId(next)
    }
    capturePostHog('sport_filter_changed', {
      sport_id: next,
    })
  }

  return (
    <div className={className}>
      <h2 className="font-display text-xl leading-none tracking-wide text-foreground">
        Upcoming Matches
      </h2>
      {onMyMatchesToggle ? (
        <div className="mt-2.5 flex min-w-0 items-center">
          <MyMatchesFilterChip
            active={myMatchesActive}
            onToggle={onMyMatchesToggle}
          />
        </div>
      ) : null}
      <SportBubblesRow
        className={cn('mt-2', sportRowClassName)}
        selectedSportId={selectedSportId}
        onSelectedSportIdChange={handleSportChange}
      />
      <EventPillsRow
        selectedSportId={selectedSportId}
        hideMatchSlider={hideMatchSlider}
        selectedEventId={selectedEventId}
        onSelectedEventIdChange={onSelectedEventIdChange}
        className="mt-3"
      />
    </div>
  )
}
