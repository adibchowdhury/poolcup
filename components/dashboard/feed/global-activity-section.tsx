'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, GitBranch, TrendingUp, Users } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import {
  formatFeaturedKickoffLocal,
  formatFeaturedMatchRoundLabel,
} from '@/src/lib/featured-match'
import {
  fetchGlobalActivityFeed,
  type BiggestCommunityClimb,
  type ClosestCallActivity,
  type GlobalActivityFeedData,
  type GlobalActivityMatch,
} from '@/src/lib/fetch-global-activity-feed'
import { supabase } from '@/src/lib/supabase'

type GlobalActivitySectionProps = {
  userId: string
}

function CompactMatchHeader({
  match,
  eyebrow,
}: {
  match: GlobalActivityMatch
  eyebrow: string
}) {
  const roundLabel = formatFeaturedMatchRoundLabel(
    match.round,
    match.groupName,
  )

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <TeamFlagImage
            countryName={match.team1Name}
            dbFlag={match.team1Flag}
            logoUrl={match.team1Logo}
            imgClassName="h-5 w-7 shrink-0 rounded-sm object-contain"
            emojiClassName="text-sm"
          />
          <p className="truncate text-sm font-semibold text-foreground">
            {match.team1Name}
            <span className="mx-1.5 text-muted-foreground">vs</span>
            {match.team2Name}
          </p>
          <TeamFlagImage
            countryName={match.team2Name}
            dbFlag={match.team2Flag}
            logoUrl={match.team2Logo}
            imgClassName="h-5 w-7 shrink-0 rounded-sm object-contain"
            emojiClassName="text-sm"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{roundLabel}</p>
      </div>
      <Link
        href={`/match/${match.id}`}
        className="shrink-0 rounded-sm text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        View
      </Link>
    </div>
  )
}

export function MostPredictedCard({ match }: { match: GlobalActivityMatch }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 sm:px-3.5">
      <CompactMatchHeader match={match} eyebrow="Most predicted" />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
          {match.totalPredictions.toLocaleString()} predictions
        </span>
        {match.topScoreline ? (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono tabular-nums">
              Top {match.topScoreline.team1}–{match.topScoreline.team2}
            </span>
          </>
        ) : null}
      </div>
      {!match.isLocked ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Kickoff {formatFeaturedKickoffLocal(match.kickoffAt)}. Crowd % after
          kickoff.
        </p>
      ) : match.confidenceLabel ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {match.confidenceLabel}
          {match.dominant ? ` · lean ${match.dominant.label}` : ''}
        </p>
      ) : null}
    </div>
  )
}

export function ClosestCallCard({ item }: { item: ClosestCallActivity }) {
  const { match } = item
  const splitPct = Math.round(item.maxShare * 100)

  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 sm:px-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5" aria-hidden />
        Closest call
      </div>
      <div className="mt-1.5">
        <CompactMatchHeader
          match={match}
          eyebrow={`${splitPct}% lean · ${match.confidenceLabel ?? 'Split'}`}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Most evenly split crowd among recent locked matches.
      </p>
    </div>
  )
}

export function BiggestCommunityClimbCard({
  item,
}: {
  item: BiggestCommunityClimb
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 sm:px-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden />
        Biggest climb
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
        {item.poolName}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Climbed{' '}
        <span className="font-medium tabular-nums text-primary">
          +{item.rankDelta}
        </span>{' '}
        to rank #{item.rank}
        {item.prevRank > 0 ? (
          <span className="text-muted-foreground">
            {' '}
            (was #{item.prevRank})
          </span>
        ) : null}
      </p>
    </div>
  )
}

export function GlobalActivitySkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <ShimmerBlock key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  )
}

/**
 * Compact community strip — max 2 cards.
 * Full highlights (incl. biggest climb): /activity
 */
export function GlobalActivitySection({ userId }: GlobalActivitySectionProps) {
  const [data, setData] = useState<GlobalActivityFeedData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const next = await fetchGlobalActivityFeed(supabase, userId)
    setData(next)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <DashboardFeedSection
      id="global-activity"
      title="Global PoolCup Activity"
      action={
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/activity">
            View All
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      }
    >
      <DashboardPlainCard className="p-3 sm:p-4">
        {loading && !data ? (
          <GlobalActivitySkeleton />
        ) : data?.error && data.isEmpty ? (
          <div className="space-y-3 py-1 text-center">
            <p className="text-sm text-destructive">{data.error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        ) : data?.isEmpty ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            Community stats will show once predictions and leaderboard movements
            are in.
          </p>
        ) : data ? (
          <div className="space-y-2">
            {data.mostPredicted ? (
              <MostPredictedCard match={data.mostPredicted} />
            ) : null}
            {data.closestCall &&
            data.closestCall.match.id !== data.mostPredicted?.id ? (
              <ClosestCallCard item={data.closestCall} />
            ) : null}
            {!data.mostPredicted && !data.closestCall ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No community highlights right now.
              </p>
            ) : null}
          </div>
        ) : null}
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
