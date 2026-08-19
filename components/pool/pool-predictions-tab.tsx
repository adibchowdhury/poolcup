'use client'

import { useMemo } from 'react'
import { ProgressHeader } from '@/components/predict/progress-header'
import { WinnerOnlyPredictView } from '@/components/predict/winner-only-predict-view'
import {
  classicMatchTotalCount,
  countClassicPredictedScores,
} from '@/src/lib/classic-prediction-progress'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { YourPredictionsSection } from '@/components/pool/your-predictions-section'

export type { UserPoolPrediction } from '@/components/pool/prediction-match-card'

type WinnerOnlyPool = {
  id: string
  name: string
  invite_code: string
  scoring_style: string
  event_id: string | null
}

type PoolPredictionsTabProps = {
  scoringStyle: string
  predictions: UserPoolPrediction[]
  totalMatchCount: number
  poolId?: string
  memberId?: string
  currentUserId?: string
  winnerPool?: WinnerOnlyPool
  inviteCode?: string
  onPredictionSaved?: (
    matchId: string,
    predTeam1: number,
    predTeam2: number,
    advancePick?: number | null,
  ) => void
  onPredictionRemoved?: (matchId: string) => void
}

export function PoolPredictionsTab({
  scoringStyle,
  predictions,
  totalMatchCount,
  poolId,
  memberId,
  currentUserId,
  winnerPool,
  inviteCode,
  onPredictionSaved,
  onPredictionRemoved,
}: PoolPredictionsTabProps) {
  const isWinnerOnly = scoringStyle === 'winner'
  const predictedMatchCount = useMemo(
    () =>
      countClassicPredictedScores(
        predictions.map((prediction) => ({
          score1: String(prediction.predTeam1 ?? ''),
          score2: String(prediction.predTeam2 ?? ''),
        })),
      ),
    [predictions],
  )
  const classicMatchTotal = classicMatchTotalCount(totalMatchCount)

  return (
    <div className="w-full min-w-0 space-y-4">
      {isWinnerOnly ? (
        memberId && winnerPool && inviteCode ? (
          <WinnerOnlyPredictView
            pool={winnerPool}
            memberId={memberId}
            inviteCode={inviteCode}
            embedded
          />
        ) : (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            Join this pool to make predictions.
          </p>
        )
      ) : (
        <>
          <ProgressHeader
            current={predictedMatchCount}
            total={classicMatchTotal}
          />
          <YourPredictionsSection
            classicPredictions={predictions}
            poolId={poolId}
            memberId={memberId}
            currentUserId={currentUserId}
            onPredictionSaved={onPredictionSaved}
            onPredictionRemoved={onPredictionRemoved}
          />
        </>
      )}
    </div>
  )
}
