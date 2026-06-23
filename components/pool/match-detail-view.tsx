'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Lock, Target, Trophy } from 'lucide-react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { CompactMatchRowReadOnlyScores } from '@/components/predict/predict-match-row-shared'
import {
  FeaturedMatchCountdownDisplay,
  useKickoffCountdown,
} from '@/components/dashboard/live-scoreboard'
import { MatchRoomPicksPanel } from '@/components/pool/match-room-picks-panel'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { resolveAdvancePickTeamName } from '@/src/lib/knockout-match-prediction'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'
import {
  formatFeaturedKickoffLocal,
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import { isMatchLocked } from '@/src/lib/match-lock'
import type { MatchPoolPick } from '@/src/lib/match-pool-picks'
import {
  formatLivePointsSummary,
  getScoringRulesLines,
} from '@/src/lib/project-match-points'
import type { MatchScoringStyle } from '@/src/lib/prediction-scoring'
import type { UserPoolRef } from '@/src/lib/resolve-match-pool'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

export type MatchPredictionDistribution = {
  total: number
  outcomes: {
    team1_win: number
    draw: number
    team2_win: number
  }
  top_scores: Array<{ team1: number; team2: number; count: number }>
}

export type MatchDetailPhase = 'upcoming' | 'live' | 'final'

type MatchDetailViewProps = {
  inviteCode: string
  poolName: string
  poolId: string
  matchId: string
  scoringStyle: MatchScoringStyle
  currentUserId: string
  prediction: UserPoolPrediction
  pointsAwarded: number | null
  phase: MatchDetailPhase
  statusShort: string | null
  elapsedMinute: number | null
  poolDistribution: MatchPredictionDistribution | null
  globalDistribution: MatchPredictionDistribution | null
  poolPicks: MatchPoolPick[] | null
  poolPicksLoading: boolean
  poolPicksError: string | null
  avatarsByMemberId: Map<string, string | null>
  userPools?: UserPoolRef[]
}

type DistributionScope = 'pool' | 'everyone'

function deriveMatchPhase(
  prediction: UserPoolPrediction,
): MatchDetailPhase {
  if (prediction.isFinal) return 'final'
  if (isMatchLocked(prediction.lockedAt)) return 'live'
  return 'upcoming'
}

export { deriveMatchPhase }

function MatchDetailCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </section>
  )
}

function DistributionToggle({
  scope,
  onChange,
}: {
  scope: DistributionScope
  onChange: (scope: DistributionScope) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-muted/40 p-0.5">
      <button
        type="button"
        onClick={() => onChange('pool')}
        className={cn(
          'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
          scope === 'pool'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        This pool
      </button>
      <button
        type="button"
        onClick={() => onChange('everyone')}
        className={cn(
          'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
          scope === 'everyone'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Everyone
      </button>
    </div>
  )
}

function OutcomeBar({
  label,
  count,
  total,
  accentClassName,
}: {
  label: string
  count: number
  total: number
  accentClassName: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {pct}% ({count})
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', accentClassName)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function DistributionSection({
  distribution,
  team1Name,
  team2Name,
  userPredTeam1,
  userPredTeam2,
}: {
  distribution: MatchPredictionDistribution | null
  team1Name: string
  team2Name: string
  userPredTeam1: number | null
  userPredTeam2: number | null
}) {
  const total = distribution?.total ?? 0
  const outcomes = distribution?.outcomes ?? {
    team1_win: 0,
    draw: 0,
    team2_win: 0,
  }
  const topScores = distribution?.top_scores ?? []

  return (
    <MatchDetailCard>
      <h2 className="font-display text-lg tracking-wide text-foreground">
        Prediction distribution
      </h2>
      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No predictions to show yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="space-y-3">
            <OutcomeBar
              label={`${team1Name} win`}
              count={outcomes.team1_win}
              total={total}
              accentClassName="bg-primary"
            />
            <OutcomeBar
              label="Draw"
              count={outcomes.draw}
              total={total}
              accentClassName="bg-sky-500"
            />
            <OutcomeBar
              label={`${team2Name} win`}
              count={outcomes.team2_win}
              total={total}
              accentClassName="bg-[#ffb300]"
            />
          </div>

          {topScores.length > 0 ? (
            <div className="border-t border-border/60 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Most predicted scorelines
              </p>
              <ul className="mt-3 space-y-2">
                {topScores.map((row) => {
                  const isYourPick =
                    userPredTeam1 === row.team1 && userPredTeam2 === row.team2
                  const pct = Math.round((row.count / total) * 100)

                  return (
                    <li
                      key={`${row.team1}-${row.team2}`}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-xl px-3 py-2',
                        isYourPick ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-muted/30',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {row.team1}–{row.team2}
                        </span>
                        {isYourPick ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Your pick
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {pct}% ({row.count})
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </MatchDetailCard>
  )
}

export function MatchDetailView({
  inviteCode,
  poolName,
  poolId,
  matchId,
  scoringStyle,
  currentUserId,
  prediction,
  pointsAwarded,
  phase,
  statusShort,
  elapsedMinute,
  poolDistribution,
  globalDistribution,
  poolPicks,
  poolPicksLoading,
  poolPicksError,
  avatarsByMemberId,
  userPools = [],
}: MatchDetailViewProps) {
  const router = useRouter()
  const [distributionScope, setDistributionScope] =
    useState<DistributionScope>('pool')
  const kickoffCountdown = useKickoffCountdown(prediction.kickoffAt)

  const hasPick =
    prediction.predTeam1 != null && prediction.predTeam2 != null
  const locked = phase !== 'upcoming'
  const activeDistribution =
    distributionScope === 'pool' ? poolDistribution : globalDistribution

  const score1 = prediction.resultTeam1 ?? 0
  const score2 = prediction.resultTeam2 ?? 0
  const showLiveScore = phase === 'live' || phase === 'final'

  const liveClockLabel =
    phase === 'live'
      ? formatFeaturedMatchStatusLabel(statusShort, elapsedMinute, false)
      : null

  const advancePickTeamName = resolveAdvancePickTeamName(
    prediction.advancePick,
    prediction.team1Name,
    prediction.team2Name,
  )
  const actualAdvancedTeamName =
    prediction.advancingTeam === 1
      ? prediction.team1Name
      : prediction.advancingTeam === 2
        ? prediction.team2Name
        : null

  const roundLabel = formatFeaturedMatchRoundLabel(
    prediction.round,
    prediction.groupName,
  )

  return (
    <div className={cn('min-h-screen bg-background', MOBILE_BOTTOM_NAV_PAD_CLASS)}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-20 top-40 h-96 w-96 rounded-full bg-[#ffb300]/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/pool/${inviteCode}`}
                className="group shrink-0 rounded-lg p-2 transition-colors hover:bg-muted"
                aria-label="Back to pool"
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {poolName}
                </p>
                <h1 className="truncate font-display text-xl tracking-wide text-foreground sm:text-2xl">
                  Match detail
                </h1>
              </div>
              {userPools.length >= 2 ? (
                <div className="shrink-0">
                  <label htmlFor="match-pool-switcher" className="sr-only">
                    View match in pool
                  </label>
                  <select
                    id="match-pool-switcher"
                    value={inviteCode}
                    onChange={(event) => {
                      const nextInviteCode = event.target.value
                      if (nextInviteCode === inviteCode) return
                      router.push(
                        `/pool/${nextInviteCode}/match/${matchId}`,
                      )
                    }}
                    className={cn(
                      'max-w-[9.5rem] truncate rounded-lg border border-border bg-muted/50',
                      'px-2 py-1.5 text-xs font-medium text-foreground sm:max-w-[12rem] sm:px-2.5',
                    )}
                  >
                    {userPools.map((pool) => (
                      <option key={pool.id} value={pool.inviteCode}>
                        {pool.name ?? pool.inviteCode}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:space-y-5 sm:py-8">
          <MatchDetailCard className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                {roundLabel}
              </p>
              {phase === 'live' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                  <span className="stage-live-dot h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                  Live {liveClockLabel ? `· ${liveClockLabel}` : ''}
                </span>
              ) : phase === 'final' ? (
                <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Full time
                </span>
              ) : (
                <div className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Clock className="h-3 w-3" aria-hidden />
                  <FeaturedMatchCountdownDisplay compact {...kickoffCountdown} />
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col items-stretch gap-4 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
                <TeamFlagImage
                  countryName={prediction.team1Name}
                  dbFlag={prediction.team1Flag}
                  imgClassName="h-10 w-auto sm:h-12"
                  emojiClassName="text-4xl sm:text-5xl"
                />
                <p className="text-center text-base font-bold text-foreground sm:text-left sm:text-lg">
                  {prediction.team1Name}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-center justify-center px-2">
                {showLiveScore ? (
                  <p className="font-display text-4xl leading-none tracking-wider text-foreground tabular-nums sm:text-5xl">
                    <span className="text-primary">{score1}</span>
                    <span className="mx-1.5 text-muted-foreground/80">–</span>
                    <span className="text-primary">{score2}</span>
                  </p>
                ) : (
                  <span className="font-display text-2xl uppercase tracking-[0.2em] text-muted-foreground sm:text-3xl">
                    vs
                  </span>
                )}
                {phase === 'upcoming' ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Locks at kickoff
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-end">
                <TeamFlagImage
                  countryName={prediction.team2Name}
                  dbFlag={prediction.team2Flag}
                  imgClassName="h-10 w-auto sm:h-12"
                  emojiClassName="text-4xl sm:text-5xl"
                />
                <p className="text-center text-base font-bold text-foreground sm:text-right sm:text-lg">
                  {prediction.team2Name}
                </p>
              </div>
            </div>

            {phase === 'final' && actualAdvancedTeamName ? (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Advanced:{' '}
                <span className="font-medium text-foreground">
                  {actualAdvancedTeamName}
                </span>
              </p>
            ) : null}
          </MatchDetailCard>

          <MatchDetailCard>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg tracking-wide text-foreground">
                  Your pick
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {locked ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" aria-hidden />
                      Locked
                    </span>
                  ) : (
                    'Open until kickoff'
                  )}
                </p>
              </div>
              {!locked ? (
                <Link
                  href={`/pool/${inviteCode}/predict`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Target className="h-3.5 w-3.5" aria-hidden />
                  {hasPick ? 'Edit pick' : 'Predict now'}
                </Link>
              ) : null}
            </div>

            <div className="mt-4">
              {hasPick ? (
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <CompactMatchRowReadOnlyScores
                    score1={prediction.predTeam1!}
                    score2={prediction.predTeam2!}
                  />
                  {isKnockoutRound(prediction.round) && advancePickTeamName ? (
                    <p className="text-center text-sm text-muted-foreground sm:text-right">
                      Advances:{' '}
                      <span className="font-medium text-foreground">
                        {advancePickTeamName}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t submitted a prediction for this match yet.
                </p>
              )}

              {phase === 'live' && hasPick && prediction.resultTeam1 != null && prediction.resultTeam2 != null ? (
                <p className="mt-3 text-center text-sm font-medium text-primary sm:text-left">
                  {formatLivePointsSummary(
                    prediction.round,
                    prediction.predTeam1!,
                    prediction.predTeam2!,
                    prediction.advancePick,
                    prediction.resultTeam1,
                    prediction.resultTeam2,
                    prediction.advancingTeam,
                  )}
                </p>
              ) : null}

              {phase === 'final' && hasPick && pointsAwarded != null ? (
                <p className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-primary sm:justify-start">
                  <Trophy className="h-4 w-4" aria-hidden />
                  +{pointsAwarded} points
                </p>
              ) : null}
            </div>
          </MatchDetailCard>

          {locked ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-display text-lg tracking-wide text-foreground">
                  How the pool sees it
                </h2>
                <DistributionToggle
                  scope={distributionScope}
                  onChange={setDistributionScope}
                />
              </div>

              <DistributionSection
                distribution={activeDistribution}
                team1Name={prediction.team1Name}
                team2Name={prediction.team2Name}
                userPredTeam1={prediction.predTeam1}
                userPredTeam2={prediction.predTeam2}
              />
            </>
          ) : null}

          <MatchDetailCard>
            <h2 className="font-display text-lg tracking-wide text-foreground">
              Scoring
            </h2>
            <ul className="mt-3 space-y-2">
              {getScoringRulesLines(prediction.round).map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </MatchDetailCard>

          {locked ? (
            <MatchRoomPicksPanel
              poolId={poolId}
              matchId={matchId}
              scoringStyle={scoringStyle}
              currentUserId={currentUserId}
              avatarsByMemberId={avatarsByMemberId}
              isFinal={phase === 'final'}
              resultTeam1={prediction.resultTeam1}
              resultTeam2={prediction.resultTeam2}
              matchRound={prediction.round}
              advancingTeam={prediction.advancingTeam}
              externalPicks={poolPicks}
              externalPicksLoading={poolPicksLoading}
              externalPicksError={poolPicksError}
            />
          ) : null}

          <MatchDetailCard>
            <h2 className="font-display text-lg tracking-wide text-foreground">
              Match info
            </h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Kickoff
                </dt>
                <dd className="mt-1 text-foreground">
                  <time dateTime={prediction.kickoffAt}>
                    {formatFeaturedKickoffLocal(prediction.kickoffAt)}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Round
                </dt>
                <dd className="mt-1 text-foreground">{roundLabel}</dd>
              </div>
              {prediction.groupName ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Group
                  </dt>
                  <dd className="mt-1 text-foreground">
                    Group {prediction.groupName}
                  </dd>
                </div>
              ) : null}
            </dl>
          </MatchDetailCard>
        </main>
      </div>
    </div>
  )
}
