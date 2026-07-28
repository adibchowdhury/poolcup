'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUp,
  GitBranch,
  Trophy,
  Users,
} from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { ordinalPlace } from '@/components/pool/leaderboard-grouped-list'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
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

function OutcomeBars({ match }: { match: GlobalActivityMatch }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {match.outcomeRows.map((row) => {
        const isTop = match.dominant?.key === row.key
        return (
          <li key={row.key}>
            <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px]">
              <span
                className={cn(
                  isTop
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {row.label}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {row.pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div
                className={cn(
                  'h-full rounded-full',
                  isTop ? 'bg-primary' : 'bg-muted-foreground/35',
                )}
                style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function MatchHeader({
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
            imgClassName="h-5 w-7 shrink-0 rounded-sm object-cover"
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
            imgClassName="h-5 w-7 shrink-0 rounded-sm object-cover"
            emojiClassName="text-sm"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{roundLabel}</p>
      </div>
      <Link
        href={`/match/${match.id}`}
        className="shrink-0 text-[11px] font-medium text-primary hover:underline"
      >
        View
      </Link>
    </div>
  )
}

function MostPredictedCard({ match }: { match: GlobalActivityMatch }) {
  const hasDistribution =
    match.isLocked && match.distribution != null && match.outcomeRows.length > 0

  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-3 sm:px-4">
      <MatchHeader match={match} eyebrow="Most predicted (community-wide)" />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
          {match.totalPredictions.toLocaleString()} predictions
        </span>
        {match.confidenceLabel ? (
          <>
            <span aria-hidden>·</span>
            <span>{match.confidenceLabel}</span>
          </>
        ) : null}
      </div>

      {!match.isLocked ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Kickoff {formatFeaturedKickoffLocal(match.kickoffAt)}. Crowd
          percentages appear after kickoff.
        </p>
      ) : null}

      {hasDistribution ? (
        <>
          {match.topScoreline ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Top scoreline:{' '}
              <span className="font-mono font-semibold text-foreground">
                {match.team1Name} {match.topScoreline.team1}–
                {match.topScoreline.team2} {match.team2Name}
              </span>{' '}
              ({match.topScoreline.count})
            </p>
          ) : null}
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Community pick
            </p>
            <OutcomeBars match={match} />
          </div>
        </>
      ) : match.isLocked ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Crowd percentages unavailable for this match right now.
        </p>
      ) : null}
    </div>
  )
}

function ClosestCallCard({ item }: { item: ClosestCallActivity }) {
  const { match } = item
  const splitPct = Math.round(item.maxShare * 100)

  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-3 sm:px-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5" aria-hidden />
        Closest call
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Most evenly split crowd among recent locked matches (no odds data for
        true upsets).
      </p>
      <div className="mt-2">
        <MatchHeader
          match={match}
          eyebrow={`${splitPct}% lean · ${match.confidenceLabel ?? 'Split'}`}
        />
      </div>
      {match.outcomeRows.length > 0 ? <OutcomeBars match={match} /> : null}
    </div>
  )
}

function BiggestClimbCard({ climb }: { climb: BiggestCommunityClimb }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-3 sm:px-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Biggest climber (community-wide)
      </p>
      <p className="mt-2 text-sm font-semibold text-foreground">
        Up {climb.rankDelta}{' '}
        {climb.rankDelta === 1 ? 'spot' : 'spots'} in {climb.poolName}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          {climb.prevRank} → {climb.rank}
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Trophy className="h-3 w-3 text-[#ffb300]" aria-hidden />
          Now {ordinalPlace(climb.rank)}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Anonymized — no player names shown.
      </p>
    </div>
  )
}

function GlobalActivitySkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <ShimmerBlock className="h-36 w-full rounded-xl" />
      <ShimmerBlock className="h-28 w-full rounded-xl" />
    </div>
  )
}

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
    <DashboardFeedSection id="global-activity" title="Global PoolCup Activity">
      <DashboardPlainCard>
        {loading && !data ? (
          <GlobalActivitySkeleton />
        ) : data?.error && data.isEmpty ? (
          <div className="space-y-3 py-2 text-center">
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
          <div className="space-y-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Community stats will show once predictions and leaderboard
              movements are in. Check back after matches lock.
            </p>
          </div>
        ) : data ? (
          <div className="space-y-3">
            {data.mostPredicted ? (
              <MostPredictedCard match={data.mostPredicted} />
            ) : null}
            {data.closestCall &&
            data.closestCall.match.id !== data.mostPredicted?.id ? (
              <ClosestCallCard item={data.closestCall} />
            ) : null}
            {data.biggestCommunityClimb ? (
              <BiggestClimbCard climb={data.biggestCommunityClimb} />
            ) : null}
            {data.error ? (
              <p className="text-[11px] text-muted-foreground">
                Some community stats may be incomplete: {data.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
