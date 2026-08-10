'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  MessageCircle,
  Target,
  UserPlus,
} from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import {
  fetchDashboardTodayMatches,
  type DashboardTodayMatch,
  type DashboardTodayMatchesResult,
} from '@/src/lib/dashboard-insights'
import {
  formatFeaturedKickoffLocal,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import { countryNameToThreeLetterCode } from '@/src/lib/team-flags'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'

/**
 * TODO(mock): Replace invite / unread-chat / recommend with real signals.
 * Kept in mind for later: get_dashboard_activity types
 * (rank_first | rank_up | exact_score | points_gained | submissions).
 */
const MOCK_ACTIVITY = {
  /**
   * Priority 2 — set to an object to demo invite when today has no matches.
   * Currently null so fallback recommend is reachable in empty-match days.
   */
  poolInvite: null as {
    fromDisplayName: string
    poolName: string
    inviteCode: string
  } | null,
  /** Priority 3 — count > 0 to surface unread chat branch. */
  unreadChat: {
    count: 0,
    preview: 'Sam: Did you lock in the CL final?',
  } as { count: number; preview: string } | null,
  recommendPool: {
    name: 'Champions League Official',
    detail: 'Join the Official CL pool and start predicting.',
    href: '#official-pools',
  },
}

const MATCHES_VISIBLE_CAP = 4

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
        className="flex items-start gap-2.5 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamFlagImage
            countryName={match.team1_name}
            dbFlag={match.team1_flag}
            logoUrl={match.team1_logo}
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
            logoUrl={match.team2_logo}
            imgClassName="h-5 w-5 shrink-0 object-contain"
            emojiClassName="text-base"
          />
          <span className="shrink-0 text-sm font-semibold tracking-wide text-foreground">
            {team2Code}
          </span>
        </div>
        <span
          className={cn(
            'shrink-0 text-xs font-medium',
            isMatchLiveOrFinal(match) ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {rightLabel}
        </span>
      </Link>
    </li>
  )
}

type ActivityCase =
  | { kind: 'today'; matches: DashboardTodayMatch[] }
  | {
      kind: 'invite'
      fromDisplayName: string
      poolName: string
      inviteCode: string
    }
  | { kind: 'chat'; count: number; preview: string }
  | { kind: 'recommend'; name: string; detail: string; href: string }

function resolveActivityCase(
  today: DashboardTodayMatchesResult | null,
): ActivityCase {
  if (today && today.matches.length > 0) {
    return { kind: 'today', matches: today.matches }
  }
  if (MOCK_ACTIVITY.poolInvite) {
    return { kind: 'invite', ...MOCK_ACTIVITY.poolInvite }
  }
  if (MOCK_ACTIVITY.unreadChat && MOCK_ACTIVITY.unreadChat.count > 0) {
    return { kind: 'chat', ...MOCK_ACTIVITY.unreadChat }
  }
  return { kind: 'recommend', ...MOCK_ACTIVITY.recommendPool }
}

/**
 * Single dynamic Activity card — highest-priority non-empty case only.
 * Replaces DashboardInsightCards (Today's Matches + Recent Pool Activity + Due).
 */
export function ActivitySection() {
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState<DashboardTodayMatchesResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await fetchDashboardTodayMatches(supabase)
    setToday(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activityCase = resolveActivityCase(today)

  return (
    <DashboardFeedSection id="activity" title="Activity">
      <DashboardPlainCard>
        {loading && !today ? (
          <div className="space-y-2" aria-hidden>
            <ShimmerBlock className="h-5 w-40 rounded" />
            <ShimmerBlock className="h-12 w-full rounded-xl" />
            <ShimmerBlock className="h-12 w-full rounded-xl" />
          </div>
        ) : activityCase.kind === 'today' ? (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" aria-hidden />
              <p className="text-sm font-semibold text-foreground">
                Today&apos;s matches
              </p>
            </div>
            <ul>
              {activityCase.matches.slice(0, MATCHES_VISIBLE_CAP).map((m) => (
                <TodayMatchRow key={m.id} match={m} />
              ))}
            </ul>
            {activityCase.matches.length > MATCHES_VISIBLE_CAP ? (
              <p className="mt-1 text-xs text-muted-foreground">
                +{activityCase.matches.length - MATCHES_VISIBLE_CAP} more
              </p>
            ) : null}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5 rounded-full"
            >
              <Link href={DASHBOARD_TAB_HREFS.upcoming}>
                View all matches
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        ) : activityCase.kind === 'invite' ? (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <UserPlus className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Pool invite from {activityCase.fromDisplayName}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Join {activityCase.poolName}
              </p>
              <Button asChild size="sm" className="mt-3 rounded-full">
                <Link href={`/join/${activityCase.inviteCode}`}>
                  View invite
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        ) : activityCase.kind === 'chat' ? (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffb300]/15 text-[#ffb300]">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {activityCase.count} unread chat
                {activityCase.count === 1 ? '' : 's'}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {activityCase.preview}
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-3 rounded-full"
              >
                <Link href="/chat">
                  Open chat
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Target className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Discover {activityCase.name}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {activityCase.detail}
              </p>
              <Button asChild size="sm" className="mt-3 gap-1.5 rounded-full">
                <Link href={activityCase.href}>
                  Browse pools
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
