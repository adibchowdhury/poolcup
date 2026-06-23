'use client'

import type { ReactNode } from 'react'
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

function MatchDetailCard({
  children,
  className,
}: {
  children: ReactNode
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

function GlobalDistributionSection({
  distribution,
  team1Name,
  team2Name,
}: {
  distribution: MatchPredictionDistribution | null
  team1Name: string
  team2Name: string
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
        How everyone predicted
      </h2>
      {total > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Based on {total.toLocaleString()} prediction{total === 1 ? '' : 's'} across
          PoolCup
        </p>
      ) : null}

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
                  const pct = Math.round((row.count / total) * 100)

                  return (
                    <li
                      key={`${row.team1}-${row.team2}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2"
                    >
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {row.team1}–{row.team2}
                      </span>
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
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-4">
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
                <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  PoolCup
                </p>
                <h1 className="truncate font-display text-xl tracking-wide text-foreground sm:text-2xl">
                  {match.team1Name} vs {match.team2Name}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:space-y-5 sm:py-8">
          <section
            className={cn(
              'py-4 max-sm:border-0 max-sm:bg-transparent max-sm:rounded-none max-sm:shadow-none',
              'max-sm:border-b max-sm:border-white/[0.08] max-sm:pb-5',
              'sm:overflow-hidden sm:rounded-2xl sm:border sm:border-primary/20 sm:bg-gradient-to-br sm:from-card sm:via-card sm:to-primary/[0.06] sm:p-5',
            )}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

            <div className="mt-5 flex items-center gap-1.5 sm:mt-6 sm:gap-4">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:gap-2">
                <TeamFlagImage
                  countryName={match.team1Name}
                  dbFlag={match.team1Flag}
                  imgClassName="h-8 w-auto max-w-full sm:h-12"
                  emojiClassName="text-3xl sm:text-5xl"
                />
                <p className="w-full truncate text-center text-sm font-bold text-foreground sm:text-lg">
                  {match.team1Name}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-center justify-center px-1 sm:px-2">
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

              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:gap-2">
                <TeamFlagImage
                  countryName={match.team2Name}
                  dbFlag={match.team2Flag}
                  imgClassName="h-8 w-auto max-w-full sm:h-12"
                  emojiClassName="text-3xl sm:text-5xl"
                />
                <p className="w-full truncate text-center text-sm font-bold text-foreground sm:text-lg">
                  {match.team2Name}
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
          </section>

          {locked ? (
            <GlobalDistributionSection
              distribution={distribution}
              team1Name={match.team1Name}
              team2Name={match.team2Name}
            />
          ) : (
            <MatchDetailCard>
              <h2 className="font-display text-lg tracking-wide text-foreground">
                How everyone predicted
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Predictions revealed after kickoff.
              </p>
            </MatchDetailCard>
          )}

          <MatchDetailCard>
            <h2 className="font-display text-lg tracking-wide text-foreground">
              Scoring
            </h2>
            <ul className="mt-3 space-y-2">
              {getScoringRulesLines(match.round).map((line) => (
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
                  <time dateTime={match.kickoffAt}>
                    {formatFeaturedKickoffLocal(match.kickoffAt)}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Round
                </dt>
                <dd className="mt-1 text-foreground">{roundLabel}</dd>
              </div>
              {match.groupName ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Group
                  </dt>
                  <dd className="mt-1 text-foreground">Group {match.groupName}</dd>
                </div>
              ) : null}
            </dl>
          </MatchDetailCard>
        </main>
      </div>
    </div>
  )
}
