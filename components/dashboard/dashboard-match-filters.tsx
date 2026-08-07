'use client'

import { useState } from 'react'
import { EventPillsRow } from '@/components/dashboard/event-pills-row'
import { SportBubblesRow } from '@/components/dashboard/sport-bubbles-row'
import { cn } from '@/lib/utils'

/**
 * Dashboard sport bubbles + event pills with shared filter state.
 * Default: no sport (all sports) + event "All".
 */
export function DashboardMatchFilters({
  className,
  sportRowClassName,
}: {
  className?: string
  sportRowClassName?: string
}) {
  const [selectedSportId, setSelectedSportId] = useState<string | null>(null)

  return (
    <div className={cn('space-y-3', className)}>
      <SportBubblesRow
        className={sportRowClassName}
        selectedSportId={selectedSportId}
        onSelectedSportIdChange={setSelectedSportId}
      />
      <EventPillsRow selectedSportId={selectedSportId} />
    </div>
  )
}
