'use client'

import { useMemo } from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressHeader } from '@/components/predict/progress-header'
import { WinnerOnlyPredictView } from '@/components/predict/winner-only-predict-view'
import { cn } from '@/lib/utils'
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
  acceptingMembers?: boolean
  shareOpen: boolean
  onToggleShare: () => void
  inviteCopySlot: React.ReactNode
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
  acceptingMembers = true,
  shareOpen,
  onToggleShare,
  inviteCopySlot,
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
      <Button
        type="button"
        size="lg"
        variant="outline"
        onClick={onToggleShare}
        disabled={!acceptingMembers}
        className={cn(
          'group h-14 w-full gap-3 border-2 border-border bg-card font-display text-lg tracking-wide hover:border-primary/50 hover-lift',
          !acceptingMembers &&
            'cursor-not-allowed border-amber-500/30 bg-amber-500/10 text-amber-400 hover:border-amber-500/30',
        )}
      >
        <Share2 className="h-5 w-5 transition-transform group-hover:scale-110 sm:h-6 sm:w-6" />
        {acceptingMembers ? 'Share Pool' : 'Invites closed'}
      </Button>

      {shareOpen && inviteCopySlot}

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
