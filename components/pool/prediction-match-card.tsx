'use client'

import { MatchPicksExpander } from '@/components/pool/match-picks-expander'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import {
  getPredictionOutcome,
  getPredictionOutcomeLabel,
  type MatchScoringStyle,
} from '@/src/lib/prediction-scoring'

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

function TeamColumn({
  name,
  dbFlag,
}: {
  name: string
  dbFlag: string | null
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 text-center">
      <TeamFlagImage
        countryName={name}
        dbFlag={dbFlag}
        imgClassName="h-8 w-auto sm:h-9"
        emojiClassName="text-2xl leading-none sm:text-3xl"
      />
      <span className="w-full break-words text-sm font-semibold leading-snug text-foreground sm:text-base">
        {name}
      </span>
    </div>
  )
}

export function PredictionMatchCard({
  prediction,
  poolId,
  currentUserId,
  scoringStyle = 'classic',
}: {
  prediction: UserPoolPrediction
  poolId?: string
  currentUserId?: string
  scoringStyle?: MatchScoringStyle
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
        scoringStyle,
      )
    : null

  return (
    <article className="flex min-h-[13rem] flex-col rounded-2xl border border-border bg-card p-4 sm:min-h-[14rem] sm:p-5">
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

      <div className="flex flex-1 items-center gap-2 sm:gap-3">
        <TeamColumn
          name={prediction.team1Name}
          dbFlag={prediction.team1Flag}
        />

        <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 sm:px-2">
          <div className="flex items-center gap-2 font-mono text-lg font-bold tabular-nums text-foreground">
            <span>{prediction.predTeam1}</span>
            <span className="text-muted-foreground">–</span>
            <span>{prediction.predTeam2}</span>
          </div>
          <span className="text-xs text-muted-foreground">Your prediction</span>
          {hasResult && (
            <div className="text-center text-xs text-muted-foreground">
              Actual: {prediction.resultTeam1} – {prediction.resultTeam2}
            </div>
          )}
        </div>

        <TeamColumn
          name={prediction.team2Name}
          dbFlag={prediction.team2Flag}
        />
      </div>

      {poolId && currentUserId ? (
        <MatchPicksExpander
          poolId={poolId}
          matchId={prediction.matchId}
          scoringStyle={scoringStyle}
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
