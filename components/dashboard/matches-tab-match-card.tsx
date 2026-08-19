'use client'

import { PremiumMatchCard } from '@/components/dashboard/premium-match-card'
import {
  isMatchesTabLive,
  type MatchesTabMatch,
} from '@/src/lib/fetch-matches-tab'
import type { MatchesTabPredictionSummary } from '@/src/lib/fetch-matches-tab-predictions'
import { DASHBOARD_MATCHES_CARD_HEIGHT_CLASS } from '@/src/lib/dashboard-surfaces'
import { cn } from '@/lib/utils'

export type MatchesTabMatchCardProps = {
  match: MatchesTabMatch
  eventLabel?: string | null
  /** Desktop live strip — full ring, mono score, LIVE notch, clock footer. */
  liveStrip?: boolean
  /** Desktop Matches tab — footer prediction state (upcoming only). */
  prediction?: MatchesTabPredictionSummary | null
  className?: string
}

/** Matches tab card — grid upcoming/completed and desktop live strip share one shell. */
export function MatchesTabMatchCard({
  match,
  eventLabel,
  liveStrip = false,
  prediction = null,
  className,
}: MatchesTabMatchCardProps) {
  const isLive = isMatchesTabLive(match.status_short)
  const isFinal =
    match.is_final ||
    ['FT', 'AET', 'PEN'].includes((match.status_short ?? '').toUpperCase())
  const mode = isFinal ? 'final' : isLive || liveStrip ? 'live' : 'upcoming'

  return (
    <PremiumMatchCard
      match={match}
      mode={mode}
      competitionName={eventLabel}
      href={`/match/${match.id}`}
      accentVariant={liveStrip ? 'full' : 'bottom'}
      liveWatchMode={liveStrip}
      footerBottomInset
      matchesTabPrediction={liveStrip ? null : prediction}
      className={cn(DASHBOARD_MATCHES_CARD_HEIGHT_CLASS, className)}
    />
  )
}
