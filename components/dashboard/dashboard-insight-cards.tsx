'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DashboardInsightCard,
  DASHBOARD_INSIGHT_CARD_SURFACE_CLASS,
} from '@/components/dashboard/dashboard-insight-card'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { countryNameToThreeLetterCode } from '@/src/lib/team-flags'
import { cn } from '@/lib/utils'
import {
  fetchDashboardActivity,
  fetchDashboardTodayMatches,
  isDashboardMatchDue,
  type DashboardActivityItem,
  type DashboardTodayMatch,
  type DashboardTodayMatchesResult,
} from '@/src/lib/dashboard-insights'
import {
  formatFeaturedKickoffLocal,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'

const DUE_MATCHES_VISIBLE_CAP = 4
/** Max activity rows shown in Recent Pool Activity before the CTA. */
const ACTIVITY_VISIBLE_CAP = 4
/** Fetch at least enough rows for the preview (RPC default is also 10). */
const ACTIVITY_FETCH_LIMIT = Math.max(ACTIVITY_VISIBLE_CAP, 10)

type DashboardInsightCardsProps = {
  pools: DashboardPoolCardData[]
}

function DashboardInsightCardSkeleton() {
  return (
    <div
      className={cn('animate-pulse', DASHBOARD_INSIGHT_CARD_SURFACE_CLASS)}
      aria-hidden
    >
      <div className="mb-3 h-5 w-40 rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: ACTIVITY_VISIBLE_CAP }, (_, index) => (
          <div
            key={index}
            className={cn(
              'h-4 rounded bg-muted',
              index === ACTIVITY_VISIBLE_CAP - 1 ? 'w-5/6' : 'w-full',
            )}
          />
        ))}
      </div>
    </div>
  )
}

function CardHeader({
  icon: Icon,
  title,
  iconClassName,
}: {
  icon: typeof Target
  title: string
  iconClassName?: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className={cn('h-5 w-5 shrink-0', iconClassName)} aria-hidden />
      <h3 className="font-display text-lg tracking-wide text-foreground sm:text-xl">
        {title}
      </h3>
    </div>
  )
}

function CardCta({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="mt-4 gap-1.5 border-border text-foreground hover:bg-muted"
    >
      <Link href={href}>
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </Button>
  )
}

function getCompletePredictionsHref(pools: DashboardPoolCardData[]): string {
  const scorePools = pools.filter((pool) => pool.scoringStyle !== 'winner')
  if (scorePools.length === 1) {
    const pool = scorePools[0]!
    return pool.scoringStyle === 'winner'
      ? `/pool/${pool.inviteCode}?tab=predictions`
      : `/pool/${pool.inviteCode}`
  }
  return DASHBOARD_TAB_HREFS.upcoming
}

function formatActivityLine(item: DashboardActivityItem): string {
  const actor = item.actor?.trim() || 'Someone'
  const poolName = item.pool_name?.trim() || 'a pool'

  switch (item.type) {
    case 'rank_first':
      return `${actor} moved into 1st in ${poolName}`
    case 'rank_up':
      return `${actor} climbed ${item.value ?? 0} spots in ${poolName}`
    case 'exact_score':
      return `${actor} hit an exact score`
    case 'points_gained':
      return `${actor} gained ${item.value ?? 0} points`
    case 'submissions':
      return `${item.value ?? 0} members submitted predictions in ${poolName}`
    default:
      return 'Recent pool activity'
  }
}

function activityIcon(type: DashboardActivityItem['type']) {
  switch (type) {
    case 'rank_first':
      return Trophy
    case 'rank_up':
      return TrendingUp
    case 'exact_score':
      return Target
    case 'points_gained':
      return Sparkles
    case 'submissions':
      return Users
    default:
      return Sparkles
  }
}

function isMatchLiveOrFinal(match: DashboardTodayMatch): boolean {
  const status = (match.status_short ?? '').trim().toUpperCase()
  return match.is_final || (status !== '' && status !== 'NS')
}

function TodayMatchRow({ match }: { match: DashboardTodayMatch }) {
  const rightLabel = isMatchLiveOrFinal(match)
    ? formatFeaturedMatchStatusLabel(
        match.status_short,
        match.elapsed_minute,
        match.is_final,
      )
    : formatFeaturedKickoffLocal(match.kickoff_at)
  const team1Code = countryNameToThreeLetterCode(match.team1_name)
  const team2Code = countryNameToThreeLetterCode(match.team2_name)

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <Link
        href={`/match/${match.id}`}
        aria-label={`${match.team1_name} vs ${match.team2_name}`}
        className="flex items-start gap-2.5 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/50 active:bg-muted/70"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamFlagImage
            countryName={match.team1_name}
            dbFlag={match.team1_flag}
            imgClassName="h-5 w-5 shrink-0 object-contain"
            emojiClassName="text-base"
          />
          <span className="shrink-0 text-sm font-semibold tracking-wide text-foreground">
            {team1Code}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">vs</span>
          <TeamFlagImage
            countryName={match.team2_name}
            dbFlag={match.team2_flag}
            imgClassName="h-5 w-5 shrink-0 object-contain"
            emojiClassName="text-base"
          />
          <span className="shrink-0 text-sm font-semibold tracking-wide text-foreground">
            {team2Code}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={cn(
              'text-xs font-medium',
              isMatchLiveOrFinal(match) ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {rightLabel}
          </span>
        </div>
      </Link>
    </li>
  )
}

function PredictionsDueCard({
  dueMatches,
  completePredictionsHref,
}: {
  dueMatches: DashboardTodayMatch[]
  completePredictionsHref: string
}) {
  if (dueMatches.length === 0) return null

  const visible = dueMatches.slice(0, DUE_MATCHES_VISIBLE_CAP)
  const overflow = dueMatches.length - visible.length

  return (
    <DashboardInsightCard>
      <CardHeader
        icon={AlertTriangle}
        title={`${dueMatches.length} Prediction${dueMatches.length === 1 ? '' : 's'} Due Today`}
        iconClassName="text-amber-400"
      />
      <ul className="space-y-1">
        {visible.map((match) => (
          <li
            key={match.id}
            className="text-sm text-foreground"
          >
            {match.team1_name} vs {match.team2_name} —{' '}
            {formatFeaturedKickoffLocal(match.kickoff_at)}
          </li>
        ))}
        {overflow > 0 ? (
          <li className="text-sm text-muted-foreground">+{overflow} more</li>
        ) : null}
      </ul>
      <CardCta href={completePredictionsHref} label="Complete Predictions" />
    </DashboardInsightCard>
  )
}

function TodaysMatchesCard({
  matches,
}: {
  matches: DashboardTodayMatch[]
}) {
  if (matches.length === 0) {
    return (
      <DashboardInsightCard>
        <CardHeader icon={Target} title="Today's Matches" iconClassName="text-primary" />
        <p className="text-sm text-muted-foreground">
          No matches scheduled for today.
        </p>
        <CardCta href={DASHBOARD_TAB_HREFS.upcoming} label="View All Matches" />
      </DashboardInsightCard>
    )
  }

  return (
    <DashboardInsightCard>
      <CardHeader icon={Target} title="Today's Matches" iconClassName="text-primary" />
      <ul>
        {matches.map((match) => (
          <TodayMatchRow key={match.id} match={match} />
        ))}
      </ul>
      <CardCta href={DASHBOARD_TAB_HREFS.upcoming} label="View All Matches" />
    </DashboardInsightCard>
  )
}

function RecentActivityCard({
  items,
}: {
  items: DashboardActivityItem[]
}) {
  const visibleItems = items.slice(0, ACTIVITY_VISIBLE_CAP)

  return (
    <DashboardInsightCard>
      <CardHeader icon={Sparkles} title="Recent Pool Activity" iconClassName="text-[#ffb300]" />
      {visibleItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {visibleItems.map((item, index) => {
            const Icon = activityIcon(item.type)
            return (
              <li key={`${item.type}-${item.occurred_at}-${index}`} className="flex gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-sm text-foreground">{formatActivityLine(item)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <CardCta href={DASHBOARD_TAB_HREFS.pools} label="View Activity" />
    </DashboardInsightCard>
  )
}

export function DashboardInsightCards({ pools }: DashboardInsightCardsProps) {
  const [loading, setLoading] = useState(true)
  const [todayMatches, setTodayMatches] =
    useState<DashboardTodayMatchesResult | null>(null)
  const [activity, setActivity] = useState<DashboardActivityItem[] | null>(null)

  const completePredictionsHref = useMemo(
    () => getCompletePredictionsHref(pools),
    [pools],
  )

  const dueMatches = useMemo(() => {
    if (!todayMatches) return []
    return todayMatches.matches.filter((match) =>
      isDashboardMatchDue(match, todayMatches.user_score_pool_count),
    )
  }, [todayMatches])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      const [matchesResult, activityResult] = await Promise.all([
        fetchDashboardTodayMatches(supabase),
        fetchDashboardActivity(supabase, ACTIVITY_FETCH_LIMIT),
      ])

      if (cancelled) return

      setTodayMatches(
        matchesResult ?? { user_score_pool_count: 0, matches: [] },
      )
      setActivity(activityResult ?? [])
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <DashboardInsightCardSkeleton />
        <DashboardInsightCardSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PredictionsDueCard
        dueMatches={dueMatches}
        completePredictionsHref={completePredictionsHref}
      />
      {todayMatches ? (
        <TodaysMatchesCard matches={todayMatches.matches} />
      ) : null}
      {activity ? <RecentActivityCard items={activity} /> : null}
    </div>
  )
}
