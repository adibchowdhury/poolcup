'use client'

import Link from 'next/link'
import { ChevronRight, Share2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import {
  YourPredictionsSection,
  type WinnerGroupPrediction,
} from '@/components/pool/your-predictions-section'

export type { UserPoolPrediction } from '@/components/pool/prediction-match-card'

type PoolPredictionsTabProps = {
  scoringStyle: string
  predictions: UserPoolPrediction[]
  winnerGroups: WinnerGroupPrediction[]
  thirdPlaceTeams: string[]
  openUnpredictedCount: number
  predictHref: string
  shareOpen: boolean
  onToggleShare: () => void
  inviteCopySlot: React.ReactNode
  poolId?: string
  currentUserId?: string
}

export function PoolPredictionsTab({
  scoringStyle,
  predictions,
  winnerGroups,
  thirdPlaceTeams,
  openUnpredictedCount,
  predictHref,
  shareOpen,
  onToggleShare,
  inviteCopySlot,
  poolId,
  currentUserId,
}: PoolPredictionsTabProps) {
  const isWinnerOnly = scoringStyle === 'winner'
  const hasOpenUnpredicted = !isWinnerOnly && openUnpredictedCount > 0
  const hasAnyPredictions = predictions.length > 0 || winnerGroups.length > 0
  const makePredictionsLabel = hasAnyPredictions
    ? 'Update predictions'
    : 'Make Predictions'

  return (
    <div className="w-full min-w-0 space-y-4">
      {hasOpenUnpredicted && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            You still have{' '}
            <span className="font-semibold text-primary">{openUnpredictedCount}</span>{' '}
            {openUnpredictedCount === 1 ? 'match' : 'matches'} without a prediction.
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

      <div
        className={cn(
          'grid grid-cols-1 gap-4',
          !hasOpenUnpredicted && 'sm:grid-cols-2',
        )}
      >
        {!hasOpenUnpredicted ? (
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

      {shareOpen && inviteCopySlot}

      <YourPredictionsSection
        scoringStyle={scoringStyle}
        classicPredictions={predictions}
        winnerGroups={winnerGroups}
        thirdPlaceTeams={thirdPlaceTeams}
        poolId={poolId}
        currentUserId={currentUserId}
      />
    </div>
  )
}
