'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'
import {
  formatFeaturedKickoffLocal,
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import { deriveGlobalMatchPhase } from '@/src/lib/global-match-phase'
import type { ClassicMatchRow } from '@/src/lib/merge-classic-match-predictions'
import { isMatchLocked } from '@/src/lib/match-lock'
import {
  buildOutcomeRows,
  getConsensusConfidenceLabel,
  getConsensusConfidenceLevel,
  getDominantOutcome,
  getPlayersAgreeLabel,
  type OutcomeRow,
} from '@/src/lib/match-prediction-consensus'
import {
  parseMatchPredictionDistribution,
  type MatchPredictionDistribution,
} from '@/src/lib/match-prediction-distribution'
import {
  fetchMyMatchPredictions,
  type MyMatchPredictions,
} from '@/src/lib/my-match-predictions'
import { getScoringRulesLines } from '@/src/lib/project-match-points'
import { useKickoffCountdown, useLiveMatchClock } from '../lib/live-match-clock'
import { supabase } from '../lib/supabase-mobile'
import {
  ComingSoonToast,
  useComingSoonToast,
} from '../lib/use-coming-soon-toast'

const MATCH_COLUMNS =
  'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, group_name, round, result_team1, result_team2, is_final, advancing_team, status_short, elapsed_minute'

const LIVE_REFETCH_MS = 30_000
const FLOW_SECTION_CLASS = 'border-b border-white/[0.08] py-5'
const YOUR_PREDICTION_SECTION_CLASS = cn(
  FLOW_SECTION_CLASS,
  'border-l-2 border-match-live/18 pl-4',
)

type MobileMatchDetailProps = {
  matchId: string
  onBack: () => void
}

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

function MatchDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Loading match">
      <div className="border-b border-border px-4 py-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/40" />
      </div>
      <div className="flex-1 space-y-4 px-4 py-6">
        <div className="h-40 animate-pulse rounded-2xl bg-muted/30" />
        <div className="h-28 animate-pulse rounded-2xl bg-muted/30" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted/30" />
      </div>
    </div>
  )
}

function MatchStatusPill({
  phase,
  liveClockLabel,
  kickoffCountdown,
}: {
  phase: ReturnType<typeof deriveGlobalMatchPhase>
  liveClockLabel: string | null
  kickoffCountdown: ReturnType<typeof useKickoffCountdown>
}) {
  if (phase === 'live') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-match-live/40 bg-match-live/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-match-live">
        <span className="h-2 w-2 shrink-0 rounded-full bg-match-live" aria-hidden />
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
      {kickoffCountdown.mounted && kickoffCountdown.label ? (
        <span suppressHydrationWarning>{kickoffCountdown.label}</span>
      ) : (
        <span>—</span>
      )}
    </div>
  )
}

function YourPredictionSection({
  myPredictions,
  myPredictionsLoading,
  team1Name,
  team2Name,
  crowdFavoriteScoreline,
  predictionsLocked,
  onPredictStub,
}: {
  myPredictions: MyMatchPredictions | null
  myPredictionsLoading: boolean
  team1Name: string
  team2Name: string
  crowdFavoriteScoreline: { team1: number; team2: number } | null
  predictionsLocked: boolean
  onPredictStub: () => void
}) {
  if (myPredictionsLoading) {
    return (
      <section
        className={YOUR_PREDICTION_SECTION_CLASS}
        aria-busy="true"
        aria-label="Loading your prediction"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Your prediction
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Loading your picks…</p>
      </section>
    )
  }

  const hasPrediction =
    myPredictions?.has_prediction === true && myPredictions.picks.length > 0

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
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
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

  return (
    <section className={YOUR_PREDICTION_SECTION_CLASS}>
      <p className="text-sm text-muted-foreground">
        You have not predicted this match yet.
      </p>
      <button
        type="button"
        onClick={onPredictStub}
        className="mt-2 inline-flex text-sm font-semibold text-foreground hover:text-match-live hover:underline"
      >
        Make your pick before kickoff →
      </button>
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
          className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{
            width: animate ? `${pct}%` : '0%',
            backgroundColor: isFavorite
              ? 'var(--match-consensus)'
              : 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)',
          }}
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
                    ? 'border-match-live/30 bg-match-surface px-3.5 py-1.5'
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
          <h2 className="font-display text-xl tracking-wide text-foreground">
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
              <p className="font-display text-3xl leading-none tracking-wide text-foreground">
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
                className="h-full rounded-full bg-match-data transition-[width] duration-500 motion-reduce:transition-none"
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

export function MobileMatchDetail({ matchId, onBack }: MobileMatchDetailProps) {
  const { comingSoonMessage, showComingSoon } = useComingSoonToast()
  const [match, setMatch] = useState<ClassicMatchRow | null>(null)
  const [distribution, setDistribution] =
    useState<MatchPredictionDistribution | null>(null)
  const [myPredictions, setMyPredictions] = useState<MyMatchPredictions | null>(
    null,
  )
  const [myPredictionsLoading, setMyPredictionsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const loadMatch = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoading(true)

      const { data, error } = await supabase
        .from('matches')
        .select(MATCH_COLUMNS)
        .eq('id', matchId)
        .maybeSingle()

      if (error) {
        console.error('Failed to load match:', error.message)
      }

      if (!data) {
        setNotFound(true)
        setMatch(null)
        setDistribution(null)
        setLoading(false)
        return
      }

      const matchRow = data as ClassicMatchRow
      setNotFound(false)
      setMatch(matchRow)

      if (isMatchLocked(matchRow.locked_at)) {
        const { data: distData, error: distError } = await supabase.rpc(
          'get_match_prediction_distribution',
          {
            p_match_id: matchId,
            p_pool_id: null,
          },
        )

        if (distError) {
          console.error('Failed to load global distribution:', distError.message)
          setDistribution(null)
        } else {
          setDistribution(parseMatchPredictionDistribution(distData))
        }
      } else {
        setDistribution(null)
      }

      setLoading(false)
    },
    [matchId],
  )

  const loadMyPredictions = useCallback(async () => {
    setMyPredictionsLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMyPredictions(null)
      setMyPredictionsLoading(false)
      return
    }

    const predictions = await fetchMyMatchPredictions(supabase, matchId)
    setMyPredictions(predictions)
    setMyPredictionsLoading(false)
  }, [matchId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void loadMatch(true)
    void loadMyPredictions()
  }, [loadMatch, loadMyPredictions])

  const phase = useMemo(
    () => (match ? deriveGlobalMatchPhase(match) : null),
    [match],
  )

  useEffect(() => {
    if (!match || phase !== 'live') return

    const interval = window.setInterval(() => {
      void loadMatch(false)
    }, LIVE_REFETCH_MS)

    return () => window.clearInterval(interval)
  }, [match, phase, loadMatch])

  const kickoffCountdown = useKickoffCountdown(match?.kickoff_at ?? '')
  const tickingClock = useLiveMatchClock({
    kickoff_at: match?.kickoff_at ?? '',
    status_short: match?.status_short ?? null,
  })

  if (loading) {
    return <MatchDetailSkeleton />
  }

  if (notFound || !match || !phase) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="font-display text-lg tracking-wide text-foreground">
            Match not found
          </h1>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <p className="text-center text-sm text-muted-foreground">
            This match may not exist or may have been removed.
          </p>
        </div>
      </div>
    )
  }

  const locked = phase !== 'upcoming'
  const score1 = match.result_team1 ?? 0
  const score2 = match.result_team2 ?? 0
  const showLiveScore = phase === 'live' || phase === 'final'
  const liveClockLabel =
    phase === 'live'
      ? tickingClock ??
        formatFeaturedMatchStatusLabel(
          match.status_short,
          match.elapsed_minute,
          false,
        )
      : null
  const actualAdvancedTeamName =
    match.advancing_team === 1
      ? match.team1_name
      : match.advancing_team === 2
        ? match.team2_name
        : null
  const roundLabel = formatFeaturedMatchRoundLabel(
    match.round,
    match.group_name,
  )
  const crowdFavoriteScoreline = distribution?.top_scores?.[0] ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ComingSoonToast message={comingSoonMessage} />

      <header className="sticky top-0 z-10 shrink-0 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              PoolCup
            </p>
            <h1 className="truncate font-display text-lg tracking-wide text-foreground">
              {match.team1_name} vs {match.team2_name}
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
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

          <div className="mt-5 flex items-center gap-1.5">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <TeamFlagImage
                countryName={match.team1_name}
                dbFlag={match.team1_flag}
                imgClassName="h-14 w-auto max-w-full"
                emojiClassName="text-5xl"
              />
              <p className="w-full truncate text-center text-base font-bold text-foreground">
                {match.team1_name}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-center justify-center px-0.5">
              {showLiveScore ? (
                <p className="font-display text-6xl leading-none tracking-wider tabular-nums text-match-live">
                  {score1}
                  <span className="mx-0.5 text-muted-foreground/60">–</span>
                  {score2}
                </p>
              ) : (
                <span className="font-display text-4xl uppercase tracking-[0.18em] text-muted-foreground">
                  vs
                </span>
              )}
              {phase === 'upcoming' ? (
                <p className="mt-1 text-center text-[11px] text-muted-foreground">
                  Locks at kickoff
                </p>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <TeamFlagImage
                countryName={match.team2_name}
                dbFlag={match.team2_flag}
                imgClassName="h-14 w-auto max-w-full"
                emojiClassName="text-5xl"
              />
              <p className="w-full truncate text-center text-base font-bold text-foreground">
                {match.team2_name}
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
          myPredictions={myPredictions}
          myPredictionsLoading={myPredictionsLoading}
          team1Name={match.team1_name}
          team2Name={match.team2_name}
          crowdFavoriteScoreline={crowdFavoriteScoreline}
          predictionsLocked={locked}
          onPredictStub={() => showComingSoon()}
        />

        {locked ? (
          <PoolCupConsensusSection
            distribution={distribution}
            team1Name={match.team1_name}
            team2Name={match.team2_name}
            team1Flag={match.team1_flag}
            team2Flag={match.team2_flag}
          />
        ) : (
          <section className={FLOW_SECTION_CLASS}>
            <h2 className="font-display text-xl tracking-wide text-foreground">
              PoolCup consensus
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Predictions revealed after kickoff.
            </p>
          </section>
        )}

        <CompactScoringSection round={match.round} />

        <section className="py-5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <time dateTime={match.kickoff_at}>
                {formatFeaturedKickoffLocal(match.kickoff_at)}
              </time>
            </span>
            <span className="text-border/80" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{roundLabel}</span>
            </span>
          </div>
        </section>
      </main>
    </div>
  )
}
