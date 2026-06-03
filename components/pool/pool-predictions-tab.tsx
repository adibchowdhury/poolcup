'use client'

import Link from 'next/link'
import { ChevronRight, Share2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getPredictionOutcome,
  getPredictionOutcomeLabel,
} from '@/src/lib/prediction-scoring'
import { resolveTeamFlagDisplay } from '@/src/lib/team-flags'

export type UserPoolPrediction = {
  matchId: string
  kickoffAt: string
  round: string
  groupName: string | null
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
  predTeam1: number
  predTeam2: number
  resultTeam1: number | null
  resultTeam2: number | null
  isFinal: boolean
}

const ROUND_LABELS: Record<string, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
}

function formatRoundLabel(round: string, groupName: string | null): string {
  if (round === 'group' && groupName) {
    return `Group ${groupName}`
  }
  return ROUND_LABELS[round] ?? round
}

function formatDayHeader(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function groupPredictionsByDay(
  predictions: UserPoolPrediction[],
): Map<string, UserPoolPrediction[]> {
  const sorted = [...predictions].sort(
    (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
  )
  const byDay = new Map<string, UserPoolPrediction[]>()
  for (const prediction of sorted) {
    const dayKey = new Date(prediction.kickoffAt).toDateString()
    if (!byDay.has(dayKey)) byDay.set(dayKey, [])
    byDay.get(dayKey)!.push(prediction)
  }
  return byDay
}

function PredictionMatchCard({ prediction }: { prediction: UserPoolPrediction }) {
  const hasResult =
    prediction.isFinal &&
    prediction.resultTeam1 != null &&
    prediction.resultTeam2 != null

  const outcome = hasResult
    ? getPredictionOutcome(
        prediction.predTeam1,
        prediction.predTeam2,
        prediction.resultTeam1!,
        prediction.resultTeam2!,
      )
    : null

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {formatRoundLabel(prediction.round, prediction.groupName)}
        </span>
        {outcome && (
          <span
            className={cn(
              'text-xs font-semibold',
              outcome.kind === 'exact'
                ? 'text-primary'
                : outcome.kind === 'winner'
                  ? 'text-[#ffb300]'
                  : 'text-muted-foreground',
            )}
          >
            {getPredictionOutcomeLabel(outcome.kind)} · +{outcome.points} pts
          </span>
        )}
      </div>

      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:justify-start">
          <span className="shrink-0 text-2xl sm:text-3xl" aria-hidden>
            {resolveTeamFlagDisplay(prediction.team1Name, prediction.team1Flag)}
          </span>
          <span className="truncate text-base font-semibold text-foreground sm:text-lg">
            {prediction.team1Name}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 px-2">
          <div className="flex items-center gap-2 font-mono text-lg font-bold text-foreground">
            <span>{prediction.predTeam1}</span>
            <span className="text-muted-foreground">–</span>
            <span>{prediction.predTeam2}</span>
          </div>
          <span className="text-xs text-muted-foreground">Your prediction</span>
          {hasResult && (
            <div className="mt-1 text-center text-xs text-muted-foreground">
              Actual: {prediction.resultTeam1} – {prediction.resultTeam2}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:justify-end">
          <span className="truncate text-right text-base font-semibold text-foreground sm:text-lg">
            {prediction.team2Name}
          </span>
          <span className="shrink-0 text-2xl sm:text-3xl" aria-hidden>
            {resolveTeamFlagDisplay(prediction.team2Name, prediction.team2Flag)}
          </span>
        </div>
      </div>
    </article>
  )
}

type PoolPredictionsTabProps = {
  predictions: UserPoolPrediction[]
  totalMatches: number
  predictHref: string
  shareOpen: boolean
  onToggleShare: () => void
  nextMatchIn: string | null
  inviteCopySlot: React.ReactNode
}

export function PoolPredictionsTab({
  predictions,
  totalMatches,
  predictHref,
  shareOpen,
  onToggleShare,
  nextMatchIn,
  inviteCopySlot,
}: PoolPredictionsTabProps) {
  const unpredictedCount = Math.max(0, totalMatches - predictions.length)
  const predictionsByDay = groupPredictionsByDay(predictions)

  if (predictions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Button
            asChild
            size="lg"
            className="group h-16 w-full gap-3 bg-primary font-display text-xl tracking-wide text-primary-foreground hover:bg-primary/90 hover-lift"
          >
            <Link href={predictHref}>
              <Zap className="h-6 w-6" />
              Make Predictions
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>

          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={onToggleShare}
            className="group h-16 w-full gap-3 border-2 border-border font-display text-xl tracking-wide hover:border-primary/50 hover-lift"
          >
            <Share2 className="h-6 w-6 transition-transform group-hover:scale-110" />
            Share Pool
          </Button>
        </div>

        {shareOpen && inviteCopySlot}

        {nextMatchIn && (
          <div className="text-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-6 py-3">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Next match in</span>
              <span className="font-mono text-lg font-bold text-primary">
                {nextMatchIn}
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {unpredictedCount > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            You still have{' '}
            <span className="font-semibold text-primary">{unpredictedCount}</span>{' '}
            {unpredictedCount === 1 ? 'match' : 'matches'} without a prediction.
          </p>
          <Button
            asChild
            size="sm"
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href={predictHref}>Complete predictions</Link>
          </Button>
        </div>
      )}

      <div className="space-y-8">
        {Array.from(predictionsByDay.entries()).map(([dayKey, dayPredictions]) => (
          <section key={dayKey}>
            <h3 className="mb-4 font-display text-xl tracking-wide text-foreground sm:text-2xl">
              {formatDayHeader(dayPredictions[0]!.kickoffAt)}
            </h3>
            <ul className="space-y-3">
              {dayPredictions.map((prediction) => (
                <li key={prediction.matchId}>
                  <PredictionMatchCard prediction={prediction} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Button
          asChild
          size="lg"
          variant="outline"
          className="group h-14 w-full gap-3 border-2 border-border font-display text-lg tracking-wide hover:border-primary/50 hover-lift"
        >
          <Link href={predictHref}>
            <Zap className="h-5 w-5" />
            Update predictions
          </Link>
        </Button>

        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={onToggleShare}
          className="group h-14 w-full gap-3 border-2 border-border font-display text-lg tracking-wide hover:border-primary/50 hover-lift"
        >
          <Share2 className="h-5 w-5 transition-transform group-hover:scale-110" />
          Share Pool
        </Button>
      </div>

      {shareOpen && inviteCopySlot}

      {nextMatchIn && (
        <div className="text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-6 py-3">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Next match in</span>
            <span className="font-mono text-lg font-bold text-primary">
              {nextMatchIn}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
