'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { ChevronRight, Share2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressHeader } from '@/components/predict/progress-header'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import {
  CompactMatchRowKickoffTime,
  CompactMatchRowReadOnlyScores,
} from '@/components/predict/predict-match-row-shared'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import {
  PredictionMatchCard,
  type UserPoolPrediction,
} from '@/components/pool/prediction-match-card'
import { PoolHomeSkeleton } from '@/components/pool/pool-home-skeleton'
import type { PoolHomeMeta } from '@/components/pool/pool-home-view'
import {
  buildPoolLeaderboardActivity,
  type PoolLeaderboardActivityItem,
} from '@/components/pool/pool-leaderboard-desktop-sidebar'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_FEED_SURFACE_CLASS,
  DASHBOARD_SECTION_BG,
} from '@/src/lib/dashboard-surfaces'
import { formatOrdinal } from '@/src/lib/analytics'
import { formatFeaturedKickoffLocal } from '@/src/lib/featured-match'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { isMatchLocked } from '@/src/lib/match-lock'
import {
  hasStoredClassicMatchPrediction,
  isClassicPredictionComplete,
} from '@/src/lib/merge-classic-match-predictions'
import {
  formatPickLockCountdownLabel,
  type PickLockCountdownTier,
} from '@/src/lib/make-your-picks-countdown'
import {
  countRemainingPredictions,
  findNextUpMatch,
  getClassicPredictionProgress,
  getLastFinalMatch,
  getPoolChampion,
  getPoolHomeLifecycle,
  getRecentResultMatches,
  getUpcomingMatchesAfter,
  type PoolHomeLifecycle,
} from '@/src/lib/pool-home-lifecycle'
import { normalizeMatchScoringStyle } from '@/src/lib/prediction-scoring'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'
import { isLegacyWinnerOnlyPool } from '@/src/lib/winner-only-mode'
import { sportAllowsDraw } from '@/src/lib/winner-pick-storage'

export type PoolHomeTabProps = {
  pool: PoolHomeMeta
  members: LeaderboardMember[]
  userPredictions: UserPoolPrediction[]
  currentUserId: string
  poolId?: string
  memberId?: string
  leaderboardLoading?: boolean
  leaderboardError?: string | null
  onRetryLeaderboard?: () => void
  onPredictionSaved?: (
    matchId: string,
    predTeam1: number,
    predTeam2: number,
    advancePick?: number | null,
  ) => void
  onPredictionRemoved?: (matchId: string) => void
  onGoToPredictions: () => void
  onGoToLeaderboard: () => void
  onInvite?: () => void
  className?: string
}

const SECTION_LABEL_CLASS =
  'text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground'

const CARD_CLASS = DASHBOARD_FEED_SURFACE_CLASS

const NEXT_UP_HERO_CLASS = cn(
  'rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/12 via-[#141414] to-[#111111]',
  'p-4 sm:p-5 lg:p-6',
)

const COUNTDOWN_TIER_CLASS: Record<PickLockCountdownTier, string> = {
  muted: 'text-muted-foreground',
  default: 'text-foreground',
  urgent: 'font-semibold text-[#ffb300]',
}

const PUCKY_STANDING_SRC = '/mascot/pucky_trophy.png'

function HomeSectionLabel({
  children,
  action,
}: {
  children: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className={SECTION_LABEL_CLASS}>{children}</p>
      {action}
    </div>
  )
}

function SectionLink({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-medium text-primary transition-colors hover:text-primary/80',
        FOCUS_VISIBLE_RING,
      )}
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}

function RankMovementInline({
  movement,
  rankDelta,
}: {
  movement: LeaderboardMember['movement']
  rankDelta: number
}) {
  if (movement === 'none' || rankDelta <= 0) return null
  const color =
    movement === 'up' ? 'text-primary' : 'text-red-500'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-mono text-xs font-semibold',
        color,
      )}
    >
      <span aria-hidden>{movement === 'up' ? '▲' : '▼'}</span>
      {rankDelta}
    </span>
  )
}

function formatPoolKickoffLabel(
  pool: PoolHomeMeta,
): string | null {
  if (pool.nextMatchKickoffAt) {
    return formatFeaturedKickoffLocal(pool.nextMatchKickoffAt)
  }
  if (pool.createdAt) {
    const d = new Date(pool.createdAt)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
  }
  return null
}

function MatchStatusPill({ match }: { match: UserPoolPrediction }) {
  if (match.isFinal) {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Final
      </span>
    )
  }
  if (isMatchLocked(match.lockedAt)) {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Locked
      </span>
    )
  }
  if (isClassicPredictionComplete(match)) {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
        Picked
      </span>
    )
  }
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#ffb300]">
      Needs pick
    </span>
  )
}

function UpcomingMatchRow({
  match,
  onGoToPredictions,
}: {
  match: UserPoolPrediction
  onGoToPredictions: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onGoToPredictions}
        className={cn(
          'flex w-full min-w-0 items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.03]',
          FOCUS_VISIBLE_RING,
        )}
      >
        <TeamFlagImage
          countryName={match.team1Name}
          dbFlag={match.team1Flag}
          logoUrl={match.team1Logo}
          imgClassName="h-7 w-7 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {match.team1Name} vs {match.team2Name}
          </p>
          <CompactMatchRowKickoffTime
            kickoffAt={match.kickoffAt}
            isLocked={isMatchLocked(match.lockedAt)}
            className="mt-0.5"
          />
        </div>
        <MatchStatusPill match={match} />
      </button>
    </li>
  )
}

function ActivityRow({ item }: { item: PoolLeaderboardActivityItem }) {
  return (
    <li className="flex items-start gap-2.5 py-2 first:pt-0">
      <UserAvatarImage
        avatar={item.avatar}
        customAvatarUrl={item.customAvatarUrl}
        fallbackInitials={item.userId ? null : item.name}
        fallbackColorKey={item.userId || item.name}
        className="mt-0.5 h-7 w-7 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug text-foreground/90">{item.line}</p>
        {item.timestampLabel ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
            {item.timestampLabel}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function NextUpActiveHero({
  match,
  lifecycle,
  remainingPicks,
  pool,
  poolId,
  memberId,
  currentUserId,
  winnerPickMode,
  allowDraw,
  onPredictionSaved,
  onPredictionRemoved,
  onGoToPredictions,
}: {
  match: UserPoolPrediction
  lifecycle: PoolHomeLifecycle
  remainingPicks: number
  pool: PoolHomeMeta
  poolId?: string
  memberId?: string
  currentUserId: string
  winnerPickMode: boolean
  allowDraw: boolean
  onPredictionSaved?: PoolHomeTabProps['onPredictionSaved']
  onPredictionRemoved?: PoolHomeTabProps['onPredictionRemoved']
  onGoToPredictions: () => void
}) {
  const lockAt = match.lockedAt ?? match.kickoffAt
  const canEmbedPick = Boolean(poolId && memberId) && !isMatchLocked(match.lockedAt)

  return (
    <section className="lg:col-span-2 min-w-0">
      <HomeSectionLabel>Next up</HomeSectionLabel>
      <div className={NEXT_UP_HERO_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {lifecycle === 'pre-event'
              ? 'First match on the schedule'
              : 'Your next pick'}
          </p>
          <NextUpCountdown lockAt={lockAt} />
        </div>

        {canEmbedPick ? (
          <div className="mt-4 min-w-0">
            <PredictionMatchCard
              prediction={match}
              poolId={poolId}
              memberId={memberId}
              currentUserId={currentUserId}
              scoringStyle={normalizeMatchScoringStyle(pool.scoringStyle)}
              autosave
              winnerPickMode={winnerPickMode}
              allowDraw={allowDraw}
              onPredictionSaved={onPredictionSaved}
              onPredictionRemoved={onPredictionRemoved}
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <TeamCrestMatchup match={match} size={40} />
            <p className="text-sm text-muted-foreground">
              {isMatchLocked(match.lockedAt)
                ? 'This match is locked.'
                : 'Join the pool to make predictions.'}
            </p>
          </div>
        )}

        {remainingPicks > 1 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">
              {remainingPicks}
            </span>{' '}
            open matches still need picks
          </p>
        ) : null}

        {!canEmbedPick && !isMatchLocked(match.lockedAt) ? (
          <Button
            type="button"
            size="sm"
            className={cn('mt-4', FOCUS_VISIBLE_RING)}
            onClick={onGoToPredictions}
          >
            Make prediction
          </Button>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={FOCUS_VISIBLE_RING}
              onClick={onGoToPredictions}
            >
              All predictions
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function TournamentCompleteHero({
  finalMatch,
  champion,
  memberCount,
  onGoToLeaderboard,
  onGoToPredictions,
}: {
  finalMatch: UserPoolPrediction | null
  champion: LeaderboardMember | null
  memberCount: number
  onGoToLeaderboard: () => void
  onGoToPredictions: () => void
}) {
  return (
    <section className="lg:col-span-2 min-w-0">
      <HomeSectionLabel>Tournament complete</HomeSectionLabel>
      <div className={NEXT_UP_HERO_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
              Season wrapped
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {memberCount} members competed in this pool.
            </p>
          </div>
          <Trophy
            className="h-10 w-10 shrink-0 text-primary/80"
            aria-hidden
          />
        </div>

        {finalMatch ? (
          <div
            className={cn(
              'mt-5 rounded-xl border border-white/[0.08] p-4',
              DASHBOARD_SECTION_BG,
            )}
          >
            <p className={SECTION_LABEL_CLASS}>Final result</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <TeamCrestMatchup match={finalMatch} size={36} />
              <CompactMatchRowReadOnlyScores
                score1={finalMatch.resultTeam1!}
                score2={finalMatch.resultTeam2!}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatFeaturedKickoffLocal(finalMatch.kickoffAt)}
            </p>
          </div>
        ) : null}

        {champion ? (
          <div
            className={cn(
              'mt-4 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 p-4',
            )}
          >
            <UserAvatarImage
              avatar={champion.avatar}
              customAvatarUrl={champion.customAvatarUrl}
              fallbackInitials={champion.userId ? null : champion.name}
              fallbackColorKey={champion.userId || champion.name}
              className="h-12 w-12 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                Pool champion
              </p>
              <p className="truncate font-display text-lg tracking-wide text-foreground">
                {champion.name}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono tabular-nums text-primary">
                  {champion.points}
                </span>{' '}
                points
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onGoToLeaderboard}
            className={FOCUS_VISIBLE_RING}
          >
            Final leaderboard
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onGoToPredictions}
            className={FOCUS_VISIBLE_RING}
          >
            View all results
          </Button>
        </div>
      </div>
    </section>
  )
}

function StandingCard({
  member,
  memberCount,
  lifecycle,
  loading,
  error,
  onRetry,
  onGoToLeaderboard,
}: {
  member: LeaderboardMember | null
  memberCount: number
  lifecycle: PoolHomeLifecycle
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onGoToLeaderboard: () => void
}) {
  return (
    <section className="min-w-0">
      <HomeSectionLabel
        action={
          <SectionLink label="Leaderboard" onClick={onGoToLeaderboard} />
        }
      >
        Your standing
      </HomeSectionLabel>
      <div className={cn(CARD_CLASS, 'relative p-4 sm:p-5')}>
        {loading && !member ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-8 w-24 rounded-md bg-muted/30" />
            <div className="h-4 w-full rounded-md bg-muted/20" />
          </div>
        ) : error && !member ? (
          <div>
            <p className="text-sm text-muted-foreground">{error}</p>
            {onRetry ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={onRetry}
              >
                Retry
              </Button>
            ) : null}
          </div>
        ) : member ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-display text-3xl tracking-wide text-foreground">
                    {formatOrdinal(member.rank)}
                  </span>
                  <RankMovementInline
                    movement={member.movement}
                    rankDelta={member.rankDelta}
                  />
                </div>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-primary">
                  {member.points}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    pts
                  </span>
                </p>
              </div>
              <Image
                src={PUCKY_STANDING_SRC}
                alt=""
                width={56}
                height={56}
                className="hidden shrink-0 object-contain opacity-90 sm:block"
                aria-hidden
              />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Members</dt>
                <dd className="font-mono tabular-nums">{memberCount}</dd>
              </div>
              {member.exactScores > 0 ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Exact scores</dt>
                  <dd className="font-mono tabular-nums">{member.exactScores}</dd>
                </div>
              ) : null}
            </dl>
            {lifecycle === 'pre-event' ? (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Standings update once matches kick off.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Join the pool to appear on the leaderboard.
          </p>
        )}
      </div>
    </section>
  )
}

function NextUpCountdown({ lockAt }: { lockAt: string }) {
  const { mounted, nowMs } = useClientNow(30_000)
  const countdown = mounted
    ? formatPickLockCountdownLabel(lockAt, nowMs)
    : null

  if (!countdown) {
    return (
      <span className="text-xs text-muted-foreground" suppressHydrationWarning>
        —
      </span>
    )
  }

  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        COUNTDOWN_TIER_CLASS[countdown.tier],
      )}
      suppressHydrationWarning
    >
      {countdown.label}
    </span>
  )
}

function TeamCrestMatchup({
  match,
  size = 32,
}: {
  match: UserPoolPrediction
  size?: number
}) {
  const imgClass =
    size >= 36 ? 'h-9 w-9 shrink-0 object-contain' : 'h-8 w-8 shrink-0 object-contain'

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamFlagImage
          countryName={match.team1Name}
          dbFlag={match.team1Flag}
          logoUrl={match.team1Logo}
          imgClassName={imgClass}
        />
        <span className="min-w-0 truncate text-sm font-medium">
          {match.team1Name}
        </span>
      </div>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        vs
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="min-w-0 truncate text-right text-sm font-medium">
          {match.team2Name}
        </span>
        <TeamFlagImage
          countryName={match.team2Name}
          dbFlag={match.team2Flag}
          logoUrl={match.team2Logo}
          imgClassName={imgClass}
        />
      </div>
    </div>
  )
}

export function PoolHomeTab({
  pool,
  members,
  userPredictions,
  currentUserId,
  poolId,
  memberId,
  leaderboardLoading = false,
  leaderboardError = null,
  onRetryLeaderboard,
  onPredictionSaved,
  onPredictionRemoved,
  onGoToPredictions,
  onGoToLeaderboard,
  onInvite,
  className,
}: PoolHomeTabProps) {
  const lifecycle = getPoolHomeLifecycle(pool)
  const isLegacyWinner = isLegacyWinnerOnlyPool(
    pool.scoringStyle,
    pool.legacyWinnerOnly ?? false,
  )
  const showClassic = !isLegacyWinner
  const isPerMatchWinner =
    pool.scoringStyle === 'winner' && !isLegacyWinner
  const allowDraw = sportAllowsDraw(pool.eventSport)

  const currentMember =
    members.find((m) => m.isYou || m.userId === currentUserId) ?? null
  const champion = getPoolChampion(members) as LeaderboardMember | null

  const nextUp = showClassic ? findNextUpMatch(userPredictions) : null
  const remainingPicks = showClassic
    ? countRemainingPredictions(userPredictions)
    : 0
  const progress = showClassic
    ? getClassicPredictionProgress(userPredictions, pool.totalMatches)
    : null
  const activity = buildPoolLeaderboardActivity(members, 5)
  const finalMatch = showClassic ? getLastFinalMatch(userPredictions) : null
  const upcomingAfterNext = showClassic
    ? getUpcomingMatchesAfter(
        userPredictions,
        nextUp?.matchId ?? null,
        3,
      )
    : []
  const recentResults = showClassic
    ? getRecentResultMatches(userPredictions, 3)
    : []

  const kickoffLabel = formatPoolKickoffLabel(pool)
  const poolTypeLabel = formatScoringStyleLabel(pool.scoringStyle)

  const showProgressCard =
    showClassic &&
    progress != null &&
    lifecycle !== 'completed' &&
    progress.total > 0

  const isInitialLoad = leaderboardLoading && userPredictions.length === 0

  if (isInitialLoad) {
    return (
      <div className={cn('w-full min-w-0', className)}>
        <PoolHomeSkeleton />
      </div>
    )
  }

  if (isLegacyWinner && lifecycle !== 'completed') {
    return (
      <div className={cn('w-full min-w-0 space-y-4', className)}>
        <div className={cn(CARD_CLASS, 'p-5')}>
          <p className="text-sm text-muted-foreground">
            Make your group and knockout picks on the Predictions tab.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-4"
            onClick={onGoToPredictions}
          >
            Go to Predictions
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        {/* Row 1 — Next Up (2 cols) + Standing */}
        {lifecycle === 'completed' ? (
          <TournamentCompleteHero
            finalMatch={finalMatch}
            champion={champion}
            memberCount={pool.memberCount}
            onGoToLeaderboard={onGoToLeaderboard}
            onGoToPredictions={onGoToPredictions}
          />
        ) : nextUp ? (
          <NextUpActiveHero
            match={nextUp}
            lifecycle={lifecycle}
            remainingPicks={remainingPicks}
            pool={pool}
            poolId={poolId}
            memberId={memberId}
            currentUserId={currentUserId}
            winnerPickMode={isPerMatchWinner}
            allowDraw={allowDraw}
            onPredictionSaved={onPredictionSaved}
            onPredictionRemoved={onPredictionRemoved}
            onGoToPredictions={onGoToPredictions}
          />
        ) : (
          <section className="lg:col-span-2 min-w-0">
            <HomeSectionLabel>Next up</HomeSectionLabel>
            <div className={cn(CARD_CLASS, 'p-5')}>
              <p className="text-sm text-muted-foreground">
                No upcoming matches right now.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={onGoToPredictions}
              >
                View predictions
              </Button>
            </div>
          </section>
        )}

        <StandingCard
          member={currentMember}
          memberCount={pool.memberCount}
          lifecycle={lifecycle}
          loading={leaderboardLoading}
          error={leaderboardError}
          onRetry={onRetryLeaderboard}
          onGoToLeaderboard={onGoToLeaderboard}
        />

        {/* Row 2 — Progress · Overview · Activity */}
        {showProgressCard && progress ? (
          <section className="min-w-0">
            <HomeSectionLabel
              action={
                progress.remaining > 0 ? (
                  <SectionLink
                    label="Predictions"
                    onClick={onGoToPredictions}
                  />
                ) : undefined
              }
            >
              Your progress
            </HomeSectionLabel>
            <div className={cn(CARD_CLASS, 'p-4')}>
              <ProgressHeader
                current={progress.completed}
                total={progress.total}
                headline={`${Math.round(
                  (progress.completed / progress.total) * 100,
                )}% complete`}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-mono tabular-nums text-foreground">
                  {progress.completed}
                </span>{' '}
                completed ·{' '}
                <span className="font-mono tabular-nums text-foreground">
                  {progress.remaining}
                </span>{' '}
                remaining
              </p>
              {progress.remaining > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn('mt-4', FOCUS_VISIBLE_RING)}
                  onClick={onGoToPredictions}
                >
                  Finish predictions
                </Button>
              ) : (
                <p className="mt-3 text-sm text-primary">All picks in.</p>
              )}
            </div>
          </section>
        ) : lifecycle === 'completed' && progress ? (
          <section className="min-w-0">
            <HomeSectionLabel>Your progress</HomeSectionLabel>
            <div className={cn(CARD_CLASS, 'p-4')}>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono tabular-nums text-foreground">
                  {progress.completed}
                </span>
                {' / '}
                <span className="font-mono tabular-nums text-foreground">
                  {progress.total}
                </span>{' '}
                predictions made
              </p>
            </div>
          </section>
        ) : null}

        <section className="min-w-0">
          <HomeSectionLabel>Pool overview</HomeSectionLabel>
          <div className={cn(CARD_CLASS, 'p-4')}>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Members</dt>
                <dd className="font-mono tabular-nums">{pool.memberCount}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Matches</dt>
                <dd className="font-mono tabular-nums">
                  {pool.matchesPlayed > 0
                    ? `${pool.matchesPlayed} / ${pool.totalMatches}`
                    : pool.totalMatches}
                </dd>
              </div>
              {kickoffLabel ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Kickoff</dt>
                  <dd className="text-right text-foreground/90">{kickoffLabel}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="text-right text-foreground/90">{poolTypeLabel}</dd>
              </div>
            </dl>
            {pool.acceptingMembers && onInvite ? (
              <Button
                type="button"
                size="sm"
                className={cn('mt-4 w-full gap-1.5', FOCUS_VISIBLE_RING)}
                onClick={onInvite}
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden />
                Invite members
              </Button>
            ) : null}
          </div>
        </section>

        <section className="min-w-0">
          <HomeSectionLabel>Recent activity</HomeSectionLabel>
          <div className={cn(CARD_CLASS, 'p-4')}>
            {activity.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground/80">
                No recent standings moves yet.
              </p>
            ) : (
              <ul>
                {activity.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Row 3 — Upcoming or recent results */}
        <section className="lg:col-span-2 min-w-0">
          {lifecycle === 'completed' ? (
            <>
              <HomeSectionLabel
                action={
                  <SectionLink
                    label="View all"
                    onClick={onGoToPredictions}
                  />
                }
              >
                Recent results
              </HomeSectionLabel>
              <div className={cn(CARD_CLASS, 'px-4')}>
                {recentResults.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    Season complete — no scored predictions to show.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {recentResults.map((match) => (
                      <li
                        key={match.matchId}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {match.team1Name} vs {match.team2Name}
                          </p>
                          <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                            {hasStoredClassicMatchPrediction(match)
                              ? `Pick ${match.predTeam1}–${match.predTeam2}`
                              : 'No pick'}
                            {match.pointsAwarded != null
                              ? ` · ${match.pointsAwarded} pts`
                              : ''}
                          </p>
                        </div>
                        <CompactMatchRowReadOnlyScores
                          score1={match.resultTeam1!}
                          score2={match.resultTeam2!}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <HomeSectionLabel
                action={
                  <SectionLink
                    label="View all"
                    onClick={onGoToPredictions}
                  />
                }
              >
                Upcoming matches
              </HomeSectionLabel>
              <div className={cn(CARD_CLASS, 'px-4')}>
                {upcomingAfterNext.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No more upcoming matches on the schedule.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {upcomingAfterNext.map((match) => (
                      <UpcomingMatchRow
                        key={match.matchId}
                        match={match}
                        onGoToPredictions={onGoToPredictions}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
