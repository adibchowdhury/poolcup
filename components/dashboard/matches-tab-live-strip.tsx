'use client'

import { MatchesTabMatchCard } from '@/components/dashboard/matches-tab-match-card'
import type { MatchesTabMatch } from '@/src/lib/fetch-matches-tab'
import { DASHBOARD_MATCHES_LIVE_STRIP_CARD_CELL_CLASS } from '@/src/lib/dashboard-surfaces'
import { cn } from '@/lib/utils'

type MatchesTabLiveStripProps = {
  matches: MatchesTabMatch[]
  eventNameById: Map<string, string>
  className?: string
}

/** Desktop Matches tab — compact horizontal live strip (watching, not predicting). */
export function MatchesTabLiveStrip({
  matches,
  eventNameById,
  className,
}: MatchesTabLiveStripProps) {
  if (matches.length === 0) return null

  const countLabel =
    matches.length === 1 ? '1 match' : `${matches.length} matches`

  return (
    <section aria-label="Live matches" className={className}>
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="stage-live-dot h-2 w-2 shrink-0 rounded-full"
            aria-hidden
          />
          <h2 className="font-display text-lg tracking-wide text-foreground uppercase">
            Live
          </h2>
        </div>
        <span className="pb-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {countLabel}
        </span>
      </div>

      <div
        className={cn(
          '@container flex min-w-0 items-start gap-2.5 overflow-x-auto overscroll-x-contain pb-0.5',
          'scrollbar-hidden [-webkit-overflow-scrolling:touch]',
        )}
        role="list"
      >
        {matches.map((match) => (
          <div
            key={match.id}
            role="listitem"
            className={cn(DASHBOARD_MATCHES_LIVE_STRIP_CARD_CELL_CLASS, 'h-[240px]')}
          >
            <MatchesTabMatchCard
              match={match}
              eventLabel={
                match.event_id ? eventNameById.get(match.event_id) : null
              }
              liveStrip
            />
          </div>
        ))}
      </div>
    </section>
  )
}
