'use client'

import { useState } from 'react'
import { ContextualLeaguePillsRow } from '@/components/dashboard/contextual-league-pills-row'
import { EventPillsRow } from '@/components/dashboard/event-pills-row'
import {
  MatchesScopeSegmentedControl,
  type MatchesScope,
} from '@/components/dashboard/matches-scope-segmented-control'
import { MyMatchesFilterChip } from '@/components/dashboard/my-matches-filter-chip'
import { SportBubblesRow } from '@/components/dashboard/sport-bubbles-row'
import type { SportingEvent } from '@/src/lib/current-event'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

/**
 * Dashboard sport bubbles + scope/league filters for the Matches tab.
 * Desktop: centered scope + sport row, wrapped league pills below.
 * Mobile: legacy chip + sport balls + full league row (unchanged).
 */
export function DashboardMatchFilters({
  className,
  sportRowClassName,
  hideMatchSlider = false,
  selectedSportId: controlledSportId,
  onSelectedSportIdChange,
  selectedEventId,
  onSelectedEventIdChange,
  matchesScope = 'all',
  onMatchesScopeChange,
  sportLeagueEvents = [],
}: {
  className?: string
  sportRowClassName?: string
  hideMatchSlider?: boolean
  selectedSportId?: string | null
  onSelectedSportIdChange?: (sportId: string | null) => void
  selectedEventId?: string
  onSelectedEventIdChange?: (eventId: string) => void
  /** Desktop segmented scope — all vs my matches. */
  matchesScope?: MatchesScope
  onMatchesScopeChange?: (scope: MatchesScope) => void
  /** Leagues/events for pills — all sports when none selected, narrowed by sport. */
  sportLeagueEvents?: SportingEvent[]
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

  const isDesktopMatchesTab = Boolean(onMatchesScopeChange)

  return (
    <div className={className}>
      {isDesktopMatchesTab ? (
        <div className="hidden min-w-0 lg:flex lg:flex-col lg:items-center lg:gap-4">
          <div className="flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <MatchesScopeSegmentedControl
              value={matchesScope}
              onChange={onMatchesScopeChange!}
              size="lg"
            />
            <SportBubblesRow
              selectedSportId={selectedSportId}
              onSelectedSportIdChange={handleSportChange}
              size="lg"
              layout="inline"
              className={sportRowClassName}
            />
          </div>

          {onSelectedEventIdChange ? (
            <ContextualLeaguePillsRow
              className="w-full max-w-5xl xl:max-w-6xl"
              events={sportLeagueEvents}
              selectedEventId={selectedEventId ?? 'all'}
              onSelectedEventIdChange={onSelectedEventIdChange}
              size="lg"
              layout="wrap"
            />
          ) : null}
        </div>
      ) : null}

      {isDesktopMatchesTab ? (
        <div className="mt-2.5 flex min-w-0 items-center lg:hidden">
          <MyMatchesFilterChip
            active={matchesScope === 'mine'}
            onToggle={() =>
              onMatchesScopeChange!(matchesScope === 'mine' ? 'all' : 'mine')
            }
          />
        </div>
      ) : null}

      <SportBubblesRow
        className={cn('mt-2 lg:mt-3 lg:hidden', sportRowClassName)}
        selectedSportId={selectedSportId}
        onSelectedSportIdChange={handleSportChange}
      />

      <EventPillsRow
        selectedSportId={selectedSportId}
        hideMatchSlider={hideMatchSlider}
        selectedEventId={selectedEventId}
        onSelectedEventIdChange={onSelectedEventIdChange}
        className="mt-3 lg:hidden"
      />
    </div>
  )
}
