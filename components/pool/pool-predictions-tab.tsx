'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight, Share2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressHeader } from '@/components/predict/progress-header'
import { cn } from '@/lib/utils'
import {
  classicMatchTotalCount,
  countClassicPredictedScores,
} from '@/src/lib/classic-prediction-progress'
import { hasStoredClassicMatchPrediction } from '@/src/lib/merge-classic-match-predictions'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import {
  YourPredictionsSection,
  type WinnerGroupPrediction,
} from '@/components/pool/your-predictions-section'

export type { UserPoolPrediction } from '@/components/pool/prediction-match-card'

type PoolPredictionsTabProps = {
  scoringStyle: string
  predictions: UserPoolPrediction[]
  totalMatchCount: number
  winnerGroups: WinnerGroupPrediction[]
  thirdPlaceTeams: string[]
  predictHref: string
  shareOpen: boolean
  onToggleShare: () => void
  inviteCopySlot: React.ReactNode
  poolId?: string
  memberId?: string
  currentUserId?: string
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
  winnerGroups,
  thirdPlaceTeams,
  predictHref,
  shareOpen,
  onToggleShare,
  inviteCopySlot,
  poolId,
  memberId,
  currentUserId,
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
  const hasAnyPredictions =
    predictions.some(hasStoredClassicMatchPrediction) || winnerGroups.length > 0
  const makePredictionsLabel = hasAnyPredictions
    ? 'Update predictions'
    : 'Make Predictions'

  return (
    <div className="w-full min-w-0 space-y-4">
      <div
        className={cn(
          'grid grid-cols-1 gap-4',
          isWinnerOnly && 'sm:grid-cols-2',
        )}
      >
        {isWinnerOnly ? (
          <Button
            asChild
            size="lg"
            variant="default"
            className={
              hasAnyPredictions
                ? 'group h-14 w-full gap-3 bg-primary font-display text-lg tracking-wide text-primary-foreground hover:bg-primary/90 hover-lift'
                : 'group h-16 w-full gap-3 bg-primary font-display text-xl tracking-wide text-primary-foreground hover:bg-primary/90 hover-lift'
            }
          >
            <Link href={predictHref}>
              <Zap className={hasAnyPredictions ? 'h-5 w-5' : 'h-6 w-6'} />
              {makePredictionsLabel}
              {!hasAnyPredictions ? (
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              ) : null}
            </Link>
          </Button>
        ) : null}

        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={onToggleShare}
          className={
            hasAnyPredictions
              ? 'group h-14 w-full gap-3 border-2 border-border bg-card font-display text-lg tracking-wide hover:border-primary/50 hover-lift'
              : 'group h-16 w-full gap-3 border-2 border-border bg-card font-display text-xl tracking-wide hover:border-primary/50 hover-lift'
          }
        >
          <Share2 className="h-5 w-5 transition-transform group-hover:scale-110 sm:h-6 sm:w-6" />
          Share Pool
        </Button>
      </div>

      {!isWinnerOnly ? (
        <ProgressHeader
          current={predictedMatchCount}
          total={classicMatchTotal}
        />
      ) : null}

      {shareOpen && inviteCopySlot}

      <YourPredictionsSection
        scoringStyle={scoringStyle}
        classicPredictions={predictions}
        winnerGroups={winnerGroups}
        thirdPlaceTeams={thirdPlaceTeams}
        poolId={poolId}
        memberId={memberId}
        currentUserId={currentUserId}
        onPredictionSaved={onPredictionSaved}
        onPredictionRemoved={onPredictionRemoved}
      />
    </div>
  )
}
