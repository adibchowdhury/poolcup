'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import { countryNameToThreeLetterCode } from '@/src/lib/team-flags'
import {
  fetchDashboardActivity,
  fetchDashboardTodayMatches,
  type DashboardActivityItem,
  type DashboardTodayMatch,
} from '@/src/lib/dashboard-insights'
import {
  formatFeaturedKickoffLocal,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import { supabase } from '../lib/supabase-mobile'

const INSIGHT_CARD_CLASS =
  'rounded-2xl border border-white/[0.09] bg-transparent p-4'

function InsightSkeleton() {
  return (
    <div className={cn(INSIGHT_CARD_CLASS, 'animate-pulse')} aria-hidden>
      <div className="mb-3 h-5 w-40 rounded bg-muted/40" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-muted/30" />
        <div className="h-4 w-5/6 rounded bg-muted/30" />
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
      <h3 className="font-display text-lg tracking-wide text-foreground">
        {title}
      </h3>
    </div>
  )
}

function isMatchLiveOrFinal(match: DashboardTodayMatch): boolean {
  const status = (match.status_short ?? '').trim().toUpperCase()
  return match.is_final || (status !== '' && status !== 'NS')
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

function TodayMatchRow({
  match,
  onOpen,
}: {
  match: DashboardTodayMatch
  onOpen: (matchId: string) => void
}) {
  const rightLabel = isMatchLiveOrFinal(match)
    ? formatFeaturedMatchStatusLabel(
        match.status_short,
        match.elapsed_minute,
        match.is_final,
      )
    : formatFeaturedKickoffLocal(match.kickoff_at)

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(match.id)}
        className="flex w-full items-start gap-2.5 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
        aria-label={`${match.team1_name} vs ${match.team2_name}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamFlagImage
            countryName={match.team1_name}
            dbFlag={match.team1_flag}
            imgClassName="h-5 w-5 shrink-0 object-contain"
            emojiClassName="text-base"
          />
          <span className="shrink-0 text-sm font-semibold tracking-wide text-foreground">
            {countryNameToThreeLetterCode(match.team1_name)}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">vs</span>
          <TeamFlagImage
            countryName={match.team2_name}
            dbFlag={match.team2_flag}
            imgClassName="h-5 w-5 shrink-0 object-contain"
            emojiClassName="text-base"
          />
          <span className="shrink-0 text-sm font-semibold tracking-wide text-foreground">
            {countryNameToThreeLetterCode(match.team2_name)}
          </span>
        </div>
        <span
          className={cn(
            'shrink-0 text-xs font-medium',
            isMatchLiveOrFinal(match) ? 'text-primary' : 'text-muted-foreground',
          )}
          suppressHydrationWarning
        >
          {rightLabel}
        </span>
      </button>
    </li>
  )
}

type MobileDashboardInsightsProps = {
  onStubAction: () => void
  onOpenMatch: (matchId: string) => void
}

export function MobileDashboardInsights({
  onStubAction,
  onOpenMatch,
}: MobileDashboardInsightsProps) {
  const [loading, setLoading] = useState(true)
  const [todayMatches, setTodayMatches] = useState<DashboardTodayMatch[]>([])
  const [todayError, setTodayError] = useState(false)
  const [activity, setActivity] = useState<DashboardActivityItem[]>([])
  const [activityError, setActivityError] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    async function load() {
      setLoading(true)

      const [matchesResult, activityResult] = await Promise.all([
        fetchDashboardTodayMatches(supabase),
        fetchDashboardActivity(supabase, 10),
      ])

      if (cancelled) return

      if (matchesResult == null) {
        setTodayError(true)
        setTodayMatches([])
      } else {
        setTodayMatches(matchesResult.matches)
      }

      if (activityResult == null) {
        setActivityError(true)
        setActivity([])
      } else {
        setActivity(activityResult)
      }

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
        <InsightSkeleton />
        <InsightSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className={INSIGHT_CARD_CLASS}>
        <CardHeader
          icon={Target}
          title="Today's Matches"
          iconClassName="text-primary"
        />
        {todayError ? (
          <p className="text-sm text-destructive">
            Could not load today&apos;s matches.
          </p>
        ) : todayMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matches scheduled for today.
          </p>
        ) : (
          <ul>
            {todayMatches.map((match) => (
              <TodayMatchRow key={match.id} match={match} onOpen={onOpenMatch} />
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onStubAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
        >
          View All Matches
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </section>

      <section className={INSIGHT_CARD_CLASS}>
        <CardHeader
          icon={Sparkles}
          title="Recent Pool Activity"
          iconClassName="text-[#ffb300]"
        />
        {activityError ? (
          <p className="text-sm text-destructive">Could not load activity.</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {activity.slice(0, 4).map((item, index) => {
              const Icon = activityIcon(item.type)
              return (
                <li key={`${item.type}-${item.occurred_at}-${index}`} className="flex gap-2.5">
                  <Icon
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="text-sm text-foreground">
                    {formatActivityLine(item)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
