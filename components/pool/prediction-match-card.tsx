'use client'

import { MatchPicksExpander } from '@/components/pool/match-picks-expander'
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

export function PredictionMatchCard({
  prediction,
  poolId,
  currentUserId,
}: {
  prediction: UserPoolPrediction
  poolId?: string
  currentUserId?: string
}) {
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

      {poolId && currentUserId ? (
        <MatchPicksExpander
          poolId={poolId}
          matchId={prediction.matchId}
          kickoffAt={prediction.kickoffAt}
          isFinal={prediction.isFinal}
          resultTeam1={prediction.resultTeam1}
          resultTeam2={prediction.resultTeam2}
          currentUserId={currentUserId}
        />
      ) : null}
    </article>
  )
}
