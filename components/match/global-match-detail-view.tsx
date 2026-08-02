'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Crown,
  Trophy,
} from 'lucide-react'
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
  getPlayersAgreeLabel,
  type OutcomeRow,
} from '@/src/lib/match-prediction-consensus'
import { getScoringRulesLines } from '@/src/lib/project-match-points'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import type { MyMatchPredictions } from '@/src/lib/my-match-predictions'
import { useAuth } from '@/src/lib/auth-context'
import { cn } from '@/lib/utils'

const FLOW_SECTION_CLASS = 'border-b border-white/[0.08] py-5 sm:py-6'

const YOUR_PREDICTION_SECTION_CLASS = cn(
  FLOW_SECTION_CLASS,
  'border-l-2 border-match-live/18 pl-4',
)

function getFavoriteTeamDisplay(
  favoriteKey: OutcomeRow['key'],
  team1Name: string,
  team2Name: string,
  team1Flag: string | null,
  team2Flag: string | null,
): { name: string; flag: string | null } | null {
  if (favoriteKey === 'team1_win') {
    return { name: team1Name, flag: team1Flag }
  }
  if (favoriteKey === 'team2_win') {
    return { name: team2Name, flag: team2Flag }
  }
  return null
}

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
          'inline-flex items-center gap-2 rounded-full border border-match-live/40 bg-match-live/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-match-live',
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
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
      <Clock className="h-3.5 w-3.5" aria-hidden />
      <FeaturedMatchCountdownDisplay compact {...kickoffCountdown} />
    </div>
  )
}

function pickMatchesCrowdFavorite(
  pick: { team1: number; team2: number },
  crowdFavorite: { team1: number; team2: number } | null,
): boolean {
  return (
    crowdFavorite != null &&
    pick.team1 === crowdFavorite.team1 &&
    pick.team2 === crowdFavorite.team2
  )
}

function YourPredictionSection({
  matchId,
  isLoggedIn,
  authLoading,
  myPredictions,
  myPredictionsLoading,
  team1Name,
  team2Name,
  crowdFavoriteScoreline,
  predictionsLocked,
}: {
  matchId: string
  isLoggedIn: boolean
  authLoading: boolean
  myPredictions: MyMatchPredictions | null
  myPredictionsLoading: boolean
  team1Name: string
  team2Name: string
  crowdFavoriteScoreline: { team1: number; team2: number } | null
  predictionsLocked: boolean
}) {
  if (authLoading || (isLoggedIn && myPredictionsLoading)) {
    return (
      <section className={YOUR_PREDICTION_SECTION_CLASS} aria-busy="true" aria-label="Loading your prediction">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Your prediction
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Loading your picks…</p>
      </section>
    )
  }

  const hasPrediction = myPredictions?.has_prediction === true && myPredictions.picks.length > 0

  if (hasPrediction && myPredictions) {
    const singlePick = myPredictions.distinct_count === 1
    const topPick = myPredictions.picks[0]
    const topMatchesCrowd = topPick
      ? pickMatchesCrowdFavorite(topPick, crowdFavoriteScoreline)
      : false

    return (
      <section className={YOUR_PREDICTION_SECTION_CLASS}>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {singlePick ? 'Your prediction' : 'Your predictions'}
        </h2>

        {singlePick && topPick ? (
          <div className="mt-2.5">
            <p className="font-mono text-base font-bold tabular-nums text-foreground">
              {team1Name}{' '}
              <span>
                {topPick.team1}–{topPick.team2}
              </span>{' '}
              {team2Name}
            </p>
            {myPredictions.pool_count > 1 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                in all {myPredictions.pool_count} of your pools
              </p>
            ) : null}
            {topMatchesCrowd ? (
              <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-match-consensus">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Matches the crowd
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="mt-2.5 space-y-2">
            {myPredictions.picks.map((pick) => {
              const matchesCrowd = pickMatchesCrowdFavorite(
                pick,
                crowdFavoriteScoreline,
              )

              return (
                <li
                  key={`${pick.team1}-${pick.team2}-${pick.pool_count}`}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-x-3 gap-y-1',
                  )}
                >
                  <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                    {team1Name}{' '}
                    <span>
                      {pick.team1}–{pick.team2}
                    </span>{' '}
                    {team2Name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    in {pick.pool_count} pool{pick.pool_count === 1 ? '' : 's'}
                    {matchesCrowd ? (
                      <span className="ml-2 font-semibold text-match-consensus">
                        · matches crowd
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {crowdFavoriteScoreline ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/[0.06] pt-3">
            <span className="text-xs font-medium text-muted-foreground">
              Crowd favorite
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {team1Name} {crowdFavoriteScoreline.team1}–
              {crowdFavoriteScoreline.team2} {team2Name}
            </span>
          </div>
        ) : !predictionsLocked ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Crowd scorelines revealed at kickoff.
          </p>
        ) : null}
      </section>
    )
  }

  const ctaHref = isLoggedIn
    ? '/dashboard?tab=upcoming'
    : `/login?next=${encodeURIComponent(`/match/${matchId}`)}`
  const ctaLabel = isLoggedIn
    ? 'Make your pick before kickoff'
    : 'Sign in to make your prediction'

  return (
    <section className={YOUR_PREDICTION_SECTION_CLASS}>
      <p className="text-sm text-muted-foreground">
        {isLoggedIn
          ? 'You have not predicted this match yet.'
          : 'Join PoolCup and predict the score.'}
      </p>
      <Link
        href={ctaHref}
        className="mt-2 inline-flex text-sm font-semibold text-foreground hover:text-match-live hover:underline"
      >
        {ctaLabel} →
      </Link>
    </section>
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
    <div className={cn('space-y-1.5', !isFavorite && 'opacity-65')}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'min-w-0 truncate font-medium',
            isFavorite ? 'text-sm text-foreground' : 'text-xs text-muted-foreground',
          )}
        >
          {row.label}
        </span>
        <span
          className={cn(
            'shrink-0 tabular-nums',
            isFavorite ? 'text-sm font-semibold text-match-consensus' : 'text-xs text-muted-foreground',
          )}
        >
          {pct}% ({row.count.toLocaleString()})
        </span>
      </div>
      <div
        className={cn(
          'overflow-hidden rounded-full bg-muted/80',
          isFavorite ? 'h-2.5' : 'h-1.5',
        )}
      >
        <div
          className={cn(
            'consensus-bar-fill motion-reduce:transition-none h-full rounded-full',
            isFavorite ? 'bg-match-consensus' : 'bg-muted-foreground/35',
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
    <div className="mt-5 border-t border-border/50 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Most predicted scorelines
      </p>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {topScores.map((row, index) => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0
          const isTop = index === 0

          return (
            <li key={`${row.team1}-${row.team2}`}>
              <div
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border',
                  isTop
                    ? 'match-crowd-favorite-chip border border-match-live/30 bg-match-surface px-3.5 py-1.5 motion-reduce:shadow-none'
                    : 'border-border/50 bg-muted/20 px-3 py-1.5 opacity-75',
                )}
              >
                {isTop ? (
                  <Crown
                    className="h-3.5 w-3.5 shrink-0 text-match-live"
                    aria-hidden
                  />
                ) : (
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                    #{index + 1}
                  </span>
                )}
                <span
                  className={cn(
                    'font-mono font-bold tabular-nums',
                    isTop ? 'text-base text-foreground' : 'text-sm text-muted-foreground',
                  )}
                >
                  {row.team1}–{row.team2}
                </span>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    isTop ? 'font-semibold text-foreground' : 'text-muted-foreground',
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
  team1Flag,
  team2Flag,
}: {
  distribution: MatchPredictionDistribution | null
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
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
  const favoriteTeam = favorite
    ? getFavoriteTeamDisplay(
        favorite.key,
        team1Name,
        team2Name,
        team1Flag,
        team2Flag,
      )
    : null

  useEffect(() => {
    const frame = requestAnimationFrame(() => setBarsReady(true))
    return () => cancelAnimationFrame(frame)
  }, [total])

  return (
    <section className={FLOW_SECTION_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
            PoolCup consensus
          </h2>
          {total > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {total.toLocaleString()}
              </span>{' '}
              predictions submitted
            </p>
          ) : null}
        </div>
        {total > 0 && favorite ? (
          <div className="rounded-full border border-match-consensus/35 bg-match-consensus/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-match-consensus">
            Crowd favorite
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No predictions to show yet.
        </p>
      ) : favorite ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-match-surface px-3.5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-match-consensus">
              Crowd favorite
            </p>
            <div className="mt-2 flex items-center gap-2.5">
              {favoriteTeam ? (
                <TeamFlagImage
                  countryName={favoriteTeam.name}
                  dbFlag={favoriteTeam.flag}
                  imgClassName="h-6 w-auto shrink-0"
                  emojiClassName="text-2xl leading-none"
                />
              ) : null}
              <p className="font-display text-3xl leading-none tracking-wide text-foreground sm:text-4xl">
                {favorite.label}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              <span>
                {favorite.count.toLocaleString()} of {total.toLocaleString()} predictions
              </span>
              <span className="text-border/80" aria-hidden>
                ·
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Trophy className="h-3.5 w-3.5 shrink-0 text-match-consensus" aria-hidden />
                {favorite.pct}% share
              </span>
            </div>
          </div>

          <div className="space-y-2.5 rounded-lg bg-match-surface/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium uppercase tracking-wider text-match-data">
                Community confidence
              </span>
              <span className="font-semibold tabular-nums text-match-data">
                {confidenceLabel}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/80">
              <div
                className="consensus-bar-fill match-confidence-bar motion-reduce:transition-none h-full rounded-full"
                style={{ width: barsReady ? `${confidenceLevel}%` : '0%' }}
              />
            </div>
            <p className="text-[11px] tabular-nums text-match-data">
              {getPlayersAgreeLabel(confidenceLevel)}
            </p>
          </div>

          <div className="space-y-2.5">
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
    </section>
  )
}

function CompactScoringSection({ round }: { round: string }) {
  const lines = getScoringRulesLines(round)

  return (
    <section className={FLOW_SECTION_CLASS}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
          <span className="font-display tracking-wide text-foreground">Scoring</span>
          <span className="inline-flex items-center gap-1 text-xs">
            {lines.length} rules
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <ul className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
          {lines.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
            >
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function CompactMatchInfo({
  kickoffAt,
  roundLabel,
}: {
  kickoffAt: string
  roundLabel: string
}) {
  return (
    <section className="py-5 sm:py-6">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
          <time dateTime={kickoffAt}>{formatFeaturedKickoffLocal(kickoffAt)}</time>
        </span>
        <span className="text-border/80" aria-hidden>
          ·
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
          <span>{roundLabel}</span>
        </span>
      </div>
    </section>
  )
}

type GlobalMatchDetailViewProps = {
  matchId: string
  match: GlobalMatchDisplay
  phase: GlobalMatchPhase
  distribution: MatchPredictionDistribution | null
  myPredictions: MyMatchPredictions | null
  myPredictionsLoading: boolean
  authLoading: boolean
  isLoggedIn: boolean
}

export function GlobalMatchDetailView({
  matchId,
  match,
  phase,
  distribution,
  myPredictions,
  myPredictionsLoading,
  authLoading,
  isLoggedIn,
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
  const crowdFavoriteScoreline = distribution?.top_scores?.[0] ?? null

  return (
    <div className={cn('min-h-screen bg-background', MOBILE_BOTTOM_NAV_PAD_CLASS)}>
      <div className="relative" id="main-content">
        <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-2.5 sm:py-3">
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

        <main className="mx-auto max-w-4xl px-4 py-4 sm:py-6">
          <section className="border-b border-white/[0.08] pb-5 pt-1">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {roundLabel}
              </p>
              <MatchStatusPill
                phase={phase}
                liveClockLabel={liveClockLabel}
                kickoffCountdown={kickoffCountdown}
              />
            </div>

            <div className="mt-5 flex items-center gap-1.5 sm:mt-6 sm:gap-5">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:gap-2">
                <TeamFlagImage
                  countryName={match.team1Name}
                  dbFlag={match.team1Flag}
                  imgClassName="h-[3.25rem] w-auto max-w-full sm:h-[4.75rem]"
                  emojiClassName="text-5xl sm:text-6xl"
                />
                <p className="w-full truncate text-center text-lg font-bold text-foreground sm:text-xl">
                  {match.team1Name}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-center justify-center px-0.5 sm:px-2">
                {showLiveScore ? (
                  <p
                    className={cn(
                      'font-display text-8xl leading-none tracking-wider tabular-nums sm:text-[10rem]',
                      'match-hero-score-emphasis motion-reduce:animate-none',
                      (phase === 'live' || phase === 'final') && 'match-hero-score-live',
                    )}
                  >
                    <span className="text-match-live">{score1}</span>
                    <span className="mx-0.5 text-muted-foreground/60 sm:mx-1.5">–</span>
                    <span className="text-match-live">{score2}</span>
                  </p>
                ) : (
                  <span className="font-display text-5xl uppercase tracking-[0.18em] text-muted-foreground sm:text-6xl">
                    vs
                  </span>
                )}
                {phase === 'upcoming' ? (
                  <p className="mt-1 text-center text-[11px] text-muted-foreground">
                    Locks at kickoff
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:gap-2">
                <TeamFlagImage
                  countryName={match.team2Name}
                  dbFlag={match.team2Flag}
                  imgClassName="h-[3.25rem] w-auto max-w-full sm:h-[4.75rem]"
                  emojiClassName="text-5xl sm:text-6xl"
                />
                <p className="w-full truncate text-center text-lg font-bold text-foreground sm:text-xl">
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

          <YourPredictionSection
            matchId={matchId}
            isLoggedIn={isLoggedIn}
            authLoading={authLoading}
            myPredictions={myPredictions}
            myPredictionsLoading={myPredictionsLoading}
            team1Name={match.team1Name}
            team2Name={match.team2Name}
            crowdFavoriteScoreline={crowdFavoriteScoreline}
            predictionsLocked={locked}
          />

          {locked ? (
            <PoolCupConsensusSection
              distribution={distribution}
              team1Name={match.team1Name}
              team2Name={match.team2Name}
              team1Flag={match.team1Flag}
              team2Flag={match.team2Flag}
            />
          ) : (
            <section className={FLOW_SECTION_CLASS}>
              <h2 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
                PoolCup consensus
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Predictions revealed after kickoff.
              </p>
            </section>
          )}

          <CompactScoringSection round={match.round} />

          <CompactMatchInfo kickoffAt={match.kickoffAt} roundLabel={roundLabel} />
        </main>
      </div>
    </div>
  )
}
