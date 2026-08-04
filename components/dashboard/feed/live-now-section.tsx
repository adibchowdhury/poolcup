'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Trophy,
} from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import {
  useLiveMatchClock,
} from '@/components/dashboard/live-scoreboard'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { ordinalPlace } from '@/components/pool/leaderboard-grouped-list'
import { cn } from '@/lib/utils'
import {
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
  type FeaturedMatch,
} from '@/src/lib/featured-match'
import {
  fetchLiveNowFeed,
  type LiveNowFeedData,
  type LiveNowMatchItem,
  type LiveNowPickProjection,
  type LiveNowStandingItem,
} from '@/src/lib/fetch-live-now-feed'
import { supabase } from '@/src/lib/supabase'

const REFETCH_INTERVAL_MS = 30_000

type LiveNowSectionProps = {
  userId: string
}

function LiveClockLabel({ match }: { match: FeaturedMatch }) {
  const liveClock = useLiveMatchClock(match)
  const fallback = formatFeaturedMatchStatusLabel(
    match.status_short,
    match.elapsed_minute,
    match.is_final,
  )
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums text-primary">
      <span
        className="stage-live-dot h-1.5 w-1.5 shrink-0 rounded-full"
        aria-hidden
      />
      {liveClock ?? (fallback || 'Live')}
    </span>
  )
}

function PickTrackBadge({ pick }: { pick: LiveNowPickProjection }) {
  const tone =
    pick.kind === 'wrong'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      : pick.kind === 'pending'
        ? 'border-border bg-muted/40 text-muted-foreground'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        tone,
      )}
    >
      {pick.statusLabel}
      {pick.projectedPoints > 0 ? (
        <span className="tabular-nums">· +{pick.projectedPoints}</span>
      ) : null}
    </span>
  )
}

function StandingMovement({
  movement,
  rankDelta,
}: {
  movement: LiveNowStandingItem['movement']
  rankDelta: number
}) {
  if (movement === 'up' && rankDelta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400">
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        {rankDelta}
      </span>
    )
  }
  if (movement === 'down' && rankDelta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-400">
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        {rankDelta}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3.5 w-3.5" aria-hidden />
    </span>
  )
}

function LiveMatchCard({ item }: { item: LiveNowMatchItem }) {
  const { match, picks } = item
  const score1 = match.result_team1 ?? 0
  const score2 = match.result_team2 ?? 0
  const hasScore =
    match.result_team1 != null && match.result_team2 != null
  const roundLabel = formatFeaturedMatchRoundLabel(
    match.round,
    match.group_name,
  )

  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <LiveClockLabel match={match} />
          <p className="mt-1 text-[11px] text-muted-foreground">{roundLabel}</p>
        </div>
        <Link
          href={`/match/${match.id}`}
          className="shrink-0 text-[11px] font-medium text-primary hover:underline"
        >
          Match room
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-semibold text-foreground">
            {match.team1_name}
          </span>
          <TeamFlagImage
            countryName={match.team1_name}
            dbFlag={match.team1_flag}
            logoUrl={match.team1_logo}
            imgClassName="h-5 w-7 shrink-0 rounded-sm object-contain"
            emojiClassName="text-sm leading-none"
          />
        </div>
        <div className="min-w-[3.5rem] text-center font-mono text-lg font-bold tabular-nums text-foreground">
          {hasScore ? `${score1}–${score2}` : '–'}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <TeamFlagImage
            countryName={match.team2_name}
            dbFlag={match.team2_flag}
            logoUrl={match.team2_logo}
            imgClassName="h-5 w-7 shrink-0 rounded-sm object-contain"
            emojiClassName="text-sm leading-none"
          />
          <span className="truncate text-sm font-semibold text-foreground">
            {match.team2_name}
          </span>
        </div>
      </div>

      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Your predictions
        </p>
        {picks.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No score picks in your pools for this match.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {picks.map((pick) => (
              <li
                key={`${pick.poolId}-${match.id}`}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <Link
                  href={`/pool/${pick.inviteCode}`}
                  className="min-w-0 truncate text-xs font-medium text-foreground hover:text-primary"
                >
                  {pick.poolName}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                    {pick.predTeam1}–{pick.predTeam2}
                    {hasScore ? (
                      <span className="ml-1.5 font-sans font-normal text-muted-foreground">
                        vs {score1}–{score2}
                      </span>
                    ) : null}
                  </span>
                  <PickTrackBadge pick={pick} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StandingsSnapshot({
  standings,
}: {
  standings: LiveNowStandingItem[]
}) {
  if (standings.length === 0) return null

  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3.5 py-3 sm:px-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Pool standings
        </p>
        <p className="text-[11px] text-muted-foreground">
          Snapshot from last scored matches — ranks update when this match
          finishes.
        </p>
      </div>
      <ul className="mt-2.5 space-y-2">
        {standings.map((row) => (
          <li
            key={row.poolId}
            className="flex items-center justify-between gap-3"
          >
            <Link
              href={`/pool/${row.inviteCode}`}
              className="min-w-0 truncate text-xs font-medium text-foreground hover:text-primary"
            >
              {row.poolName}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-foreground">
                <Trophy className="h-3 w-3 text-[#ffb300]" aria-hidden />
                {row.yourRank != null ? ordinalPlace(row.yourRank) : '—'}
              </span>
              <StandingMovement
                movement={row.movement}
                rankDelta={row.rankDelta}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LiveNowSection({ userId }: LiveNowSectionProps) {
  const [data, setData] = useState<LiveNowFeedData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true)
    const next = await fetchLiveNowFeed(supabase, userId)
    setData(next)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => {
      void load({ soft: true })
    }, REFETCH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [load])

  const hasLive = (data?.matches.length ?? 0) > 0
  const error = data?.error ?? null

  // Wait for first fetch; collapse when nothing is live (typical between matchdays).
  if (loading && !data) {
    return null
  }

  if (!loading && !error && !hasLive) {
    return null
  }

  if (error && !hasLive) {
    return (
      <DashboardFeedSection id="live-now" title="Live Now">
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Couldn&apos;t load live matches: {error}
        </p>
      </DashboardFeedSection>
    )
  }

  if (!hasLive || !data) return null

  return (
    <DashboardFeedSection id="live-now" title="Live Now">
      <div className="space-y-3">
        {data.matches.map((item) => (
          <LiveMatchCard key={item.match.id} item={item} />
        ))}
        <StandingsSnapshot standings={data.standings} />
      </div>
    </DashboardFeedSection>
  )
}
