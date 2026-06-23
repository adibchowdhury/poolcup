'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock } from 'lucide-react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import {
  FeaturedMatchCountdownDisplay,
  useKickoffCountdown,
} from '@/components/dashboard/live-scoreboard'
import {
  formatFeaturedKickoffLocal,
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import type { GlobalMatchPhase } from '@/src/lib/global-match-phase'
import type { MatchPredictionDistribution } from '@/src/lib/match-prediction-distribution'
import {
  buildOutcomeRows,
  getConsensusConfidenceLabel,
  getConsensusConfidenceLevel,
  getDominantOutcome,
  type OutcomeRow,
} from '@/src/lib/match-prediction-consensus'
import { getScoringRulesLines } from '@/src/lib/project-match-points'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { useAuth } from '@/src/lib/auth-context'
import { cn } from '@/lib/utils'

function navigateFromMatchDetailBack(
  router: ReturnType<typeof useRouter>,
  isLoggedIn: boolean,
) {
  if (!isLoggedIn) {
    router.push('/')
    return
  }

  if (typeof window !== 'undefined') {
    let sameOriginReferrer = false

    try {
      const referrer = document.referrer
      if (referrer) {
        sameOriginReferrer =
          new URL(referrer).origin === window.location.origin
      }
    } catch {
      sameOriginReferrer = false
    }

    if (sameOriginReferrer && window.history.length > 1) {
      router.back()
      return
    }
  }

  router.push('/dashboard')
}

export type GlobalMatchDisplay = {
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
  kickoffAt: string
  round: string
  groupName: string | null
  resultTeam1: number | null
  resultTeam2: number | null
  advancingTeam: number | null
  statusShort: string | null
  elapsedMinute: number | null
}

function PrimaryInsightCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-primary/25 bg-card p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  )
}

function SecondaryCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border/60 bg-muted/15 p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </section>
  )
}

function TertiaryCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border/40 px-1 py-4 sm:px-2 sm:py-5',
        className,
      )}
    >
      {children}
    </section>
  )
}

function MatchStatusPill({
  phase,
  liveClockLabel,
  kickoffCountdown,
}: {
  phase: GlobalMatchPhase
  liveClockLabel: string | null
  kickoffCountdown: ReturnType<typeof useKickoffCountdown>
}) {
  if (phase === 'live') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary',
          'match-hero-live-pill motion-reduce:shadow-none motion-reduce:animate-none',
        )}
      >
        <span className="stage-live-dot h-2 w-2 shrink-0 rounded-full" aria-hidden />
        Live {liveClockLabel ? `· ${liveClockLabel}` : ''}
      </span>
    )
  }

  if (phase === 'final') {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Full time
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
      <Clock className="h-3.5 w-3.5" aria-hidden />
      <FeaturedMatchCountdownDisplay compact {...kickoffCountdown} />
    </div>
  )
}

function ConsensusOutcomeBar({
  row,
  total,
  isFavorite,
  animate,
}: {
  row: OutcomeRow
  total: number
  isFavorite: boolean
  animate: boolean
}) {
  const pct = total > 0 ? Math.round((row.count / total) * 100) : 0

  return (
    <div
      className={cn(
        'space-y-2',
        !isFavorite && 'opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'min-w-0 truncate font-medium',
            isFavorite
              ? 'text-base text-foreground'
              : 'text-xs text-muted-foreground',
          )}
        >
          {row.label}
        </span>
        <span
          className={cn(
            'shrink-0 tabular-nums',
            isFavorite ? 'text-sm font-semibold text-primary' : 'text-xs text-muted-foreground',
          )}
        >
          {pct}% ({row.count.toLocaleString()})
        </span>
      </div>
      <div
        className={cn(
          'overflow-hidden rounded-full bg-muted/80',
          isFavorite ? 'h-3' : 'h-2',
        )}
      >
        <div
          className={cn(
            'consensus-bar-fill motion-reduce:transition-none h-full rounded-full',
            isFavorite ? 'bg-primary' : 'bg-muted-foreground/35',
          )}
          style={{ width: animate ? `${pct}%` : '0%' }}
        />
      </div>
    </div>
  )
}

function ScorelineChips({
  topScores,
  total,
}: {
  topScores: MatchPredictionDistribution['top_scores']
  total: number
}) {
  if (topScores.length === 0) return null

  return (
    <div className="mt-6 border-t border-border/50 pt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Most predicted scorelines
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {topScores.map((row, index) => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0
          const isTop = index === 0

          return (
            <li key={`${row.team1}-${row.team2}`}>
              <div
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5',
                  isTop
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border/60 bg-muted/25',
                )}
              >
                {isTop ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                    #1
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                    #{index + 1}
                  </span>
                )}
                <span
                  className={cn(
                    'font-mono text-sm font-bold tabular-nums',
                    isTop ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {row.team1}–{row.team2}
                </span>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    isTop ? 'font-semibold text-primary' : 'text-muted-foreground',
                  )}
                >
                  {pct}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PoolCupConsensusSection({
  distribution,
  team1Name,
  team2Name,
}: {
  distribution: MatchPredictionDistribution | null
  team1Name: string
  team2Name: string
}) {
  const [barsReady, setBarsReady] = useState(false)
  const total = distribution?.total ?? 0
  const outcomes = distribution?.outcomes ?? {
    team1_win: 0,
    draw: 0,
    team2_win: 0,
  }
  const topScores = distribution?.top_scores ?? []
  const outcomeRows = buildOutcomeRows(outcomes, team1Name, team2Name, total)
  const favorite = getDominantOutcome(outcomeRows)
  const maxShare = favorite && total > 0 ? favorite.count / total : 0
  const confidenceLabel = getConsensusConfidenceLabel(maxShare)
  const confidenceLevel = getConsensusConfidenceLevel(maxShare)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setBarsReady(true))
    return () => cancelAnimationFrame(frame)
  }, [total])

  return (
    <PrimaryInsightCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-wide text-foreground">
            PoolCup consensus
          </h2>
          {total > 0 ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {total.toLocaleString()}
              </span>{' '}
              prediction{total === 1 ? '' : 's'} submitted
            </p>
          ) : null}
        </div>
        {total > 0 && favorite ? (
          <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
            Crowd favorite
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No predictions to show yet.
        </p>
      ) : favorite ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Crowd favorite
            </p>
            <p className="mt-1 font-display text-3xl tracking-wide text-foreground">
              {favorite.label}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-primary">
              {favorite.pct}% of predictions
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium uppercase tracking-wider text-muted-foreground">
                Community confidence
              </span>
              <span className="font-semibold text-foreground">{confidenceLabel}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
              <div
                className="consensus-bar-fill motion-reduce:transition-none h-full rounded-full bg-primary/70"
                style={{ width: barsReady ? `${confidenceLevel}%` : '0%' }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {outcomeRows.map((row) => (
              <ConsensusOutcomeBar
                key={row.key}
                row={row}
                total={total}
                isFavorite={row.key === favorite.key}
                animate={barsReady}
              />
            ))}
          </div>

          <ScorelineChips topScores={topScores} total={total} />
        </div>
      ) : null}
    </PrimaryInsightCard>
  )
}

type GlobalMatchDetailViewProps = {
  match: GlobalMatchDisplay
  phase: GlobalMatchPhase
  distribution: MatchPredictionDistribution | null
}

export function GlobalMatchDetailView({
  match,
  phase,
  distribution,
}: GlobalMatchDetailViewProps) {
  const router = useRouter()
  const { user } = useAuth()
  const kickoffCountdown = useKickoffCountdown(match.kickoffAt)
  const locked = phase !== 'upcoming'
  const score1 = match.resultTeam1 ?? 0
  const score2 = match.resultTeam2 ?? 0
  const showLiveScore = phase === 'live' || phase === 'final'
  const liveClockLabel =
    phase === 'live'
      ? formatFeaturedMatchStatusLabel(
          match.statusShort,
          match.elapsedMinute,
          false,
        )
      : null
  const actualAdvancedTeamName =
    match.advancingTeam === 1
      ? match.team1Name
      : match.advancingTeam === 2
        ? match.team2Name
        : null
  const roundLabel = formatFeaturedMatchRoundLabel(match.round, match.groupName)

  return (
    <div className={cn('min-h-screen bg-background', MOBILE_BOTTOM_NAV_PAD_CLASS)}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-20 top-40 h-96 w-96 rounded-full bg-[#ffb300]/5 blur-3xl" />
      </div>

      <div className="relative z-10" id="main-content">
        <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigateFromMatchDetailBack(router, Boolean(user))}
                className="group shrink-0 rounded-lg p-2 transition-colors hover:bg-muted"
                aria-label={user ? 'Back to dashboard' : 'Back to home'}
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  PoolCup
                </p>
                <h1 className="truncate font-display text-lg tracking-wide text-foreground sm:text-xl">
                  {match.team1Name} vs {match.team2Name}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:space-y-10 sm:py-10">
          <section className="border-b border-white/[0.08] pb-8 pt-2 sm:pb-10 sm:pt-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {roundLabel}
              </p>
              <MatchStatusPill
                phase={phase}
                liveClockLabel={liveClockLabel}
                kickoffCountdown={kickoffCountdown}
              />
            </div>

            <div className="mt-8 flex items-center gap-2 sm:mt-10 sm:gap-6">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:gap-3">
                <TeamFlagImage
                  countryName={match.team1Name}
                  dbFlag={match.team1Flag}
                  imgClassName="h-11 w-auto max-w-full sm:h-16"
                  emojiClassName="text-4xl sm:text-6xl"
                />
                <p className="w-full truncate text-center text-base font-bold text-foreground sm:text-xl">
                  {match.team1Name}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-center justify-center px-1 sm:px-3">
                {showLiveScore ? (
                  <p
                    className={cn(
                      'font-display text-6xl leading-none tracking-wider text-foreground tabular-nums sm:text-8xl',
                      phase === 'live' && 'match-hero-score-live motion-reduce:animate-none',
                    )}
                  >
                    <span className="text-primary">{score1}</span>
                    <span className="mx-1 text-muted-foreground/70 sm:mx-2">–</span>
                    <span className="text-primary">{score2}</span>
                  </p>
                ) : (
                  <span className="font-display text-4xl uppercase tracking-[0.2em] text-muted-foreground sm:text-5xl">
                    vs
                  </span>
                )}
                {phase === 'upcoming' ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Locks at kickoff
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:gap-3">
                <TeamFlagImage
                  countryName={match.team2Name}
                  dbFlag={match.team2Flag}
                  imgClassName="h-11 w-auto max-w-full sm:h-16"
                  emojiClassName="text-4xl sm:text-6xl"
                />
                <p className="w-full truncate text-center text-base font-bold text-foreground sm:text-xl">
                  {match.team2Name}
                </p>
              </div>
            </div>

            {phase === 'final' && actualAdvancedTeamName ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Advanced:{' '}
                <span className="font-medium text-foreground">
                  {actualAdvancedTeamName}
                </span>
              </p>
            ) : null}
          </section>

          {locked ? (
            <PoolCupConsensusSection
              distribution={distribution}
              team1Name={match.team1Name}
              team2Name={match.team2Name}
            />
          ) : (
            <PrimaryInsightCard>
              <h2 className="font-display text-2xl tracking-wide text-foreground">
                PoolCup consensus
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Predictions revealed after kickoff.
              </p>
            </PrimaryInsightCard>
          )}

          <SecondaryCard>
            <h2 className="font-display text-lg tracking-wide text-foreground">
              Scoring
            </h2>
            <ul className="mt-3 space-y-2.5">
              {getScoringRulesLines(match.round).map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </SecondaryCard>

          <TertiaryCard>
            <h2 className="font-display text-base tracking-wide text-muted-foreground">
              Match info
            </h2>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Kickoff
                </dt>
                <dd className="mt-1 text-foreground">
                  <time dateTime={match.kickoffAt}>
                    {formatFeaturedKickoffLocal(match.kickoffAt)}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Round
                </dt>
                <dd className="mt-1 text-foreground">{roundLabel}</dd>
              </div>
              {match.groupName ? (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Group
                  </dt>
                  <dd className="mt-1 text-foreground">Group {match.groupName}</dd>
                </div>
              ) : null}
            </dl>
          </TertiaryCard>
        </main>
      </div>
    </div>
  )
}
