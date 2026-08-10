'use client'

import { useEffect, useState } from 'react'
import { EventPillsRow } from '@/components/dashboard/event-pills-row'
import { SportBubblesRow } from '@/components/dashboard/sport-bubbles-row'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

/**
 * Dashboard sport bubbles + event pills with shared filter state.
 * Default: favorite sport bubble when provided, else no sport (all sports) + event "All".
 * Deselecting a bubble clears to null = all sports.
 */
export function DashboardMatchFilters({
  className,
  sportRowClassName,
  defaultSportId = null,
}: {
  className?: string
  sportRowClassName?: string
  /** Sport bubble id from users.favorite_sports mapping; null = all sports. */
  defaultSportId?: string | null
}) {
  const [selectedSportId, setSelectedSportId] = useState<string | null>(
    defaultSportId,
  )

  useEffect(() => {
    setSelectedSportId(defaultSportId)
  }, [defaultSportId])

  function handleSportChange(next: string | null) {
    setSelectedSportId(next)
    capturePostHog('sport_filter_changed', {
      sport_id: next,
    })
  }

  return (
    <div className={cn('space-y-3', className)}>
      <SportBubblesRow
        className={sportRowClassName}
        selectedSportId={selectedSportId}
        onSelectedSportIdChange={handleSportChange}
      />
      <EventPillsRow selectedSportId={selectedSportId} />
    </div>
  )
}
