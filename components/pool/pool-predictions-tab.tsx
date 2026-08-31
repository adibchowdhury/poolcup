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
import { PoolPredictionsDesktopSidebar } from '@/components/pool/pool-predictions-desktop-sidebar'
import { isLegacyWinnerOnlyPool } from '@/src/lib/winner-only-mode'
import { cn } from '@/lib/utils'

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
  legacyWinnerOnly?: boolean
  eventSport?: string | null
  inviteCode?: string
  poolName?: string
  memberCount?: number
  /** From existing leaderboard members (isYou / current user). */
  userRank?: number | null
  acceptingMembers?: boolean
  /**
   * When true, omit the legacy lg+ overview/invite column — pool shell sidebar
   * replaces it (filters + Commissioner CTA live there instead).
   */
  hideDesktopOverviewSidebar?: boolean
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
  legacyWinnerOnly = false,
  eventSport = null,
  inviteCode,
  poolName = '',
  memberCount = 0,
  userRank = null,
  acceptingMembers = false,
  hideDesktopOverviewSidebar = false,
  onPredictionSaved,
  onPredictionRemoved,
}: PoolPredictionsTabProps) {
  const isLegacyWinner = isLegacyWinnerOnlyPool(scoringStyle, legacyWinnerOnly)
  const isPerMatchWinner = scoringStyle === 'winner' && !isLegacyWinner
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

  if (isLegacyWinner) {
    return (
      <div className="w-full min-w-0 space-y-4">
        {memberId && winnerPool && inviteCode ? (
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
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-full min-w-0',
        !hideDesktopOverviewSidebar && 'lg:flex lg:items-start lg:gap-4',
      )}
    >
      {/* Large basis demands width; sidebar shrinks first (shrink-3). */}
      <div
        className={cn(
          'min-w-0 space-y-4',
          hideDesktopOverviewSidebar
            ? 'w-full'
            : 'flex-1 basis-[55rem] shrink',
        )}
      >
        <ProgressHeader
          current={predictedMatchCount}
          total={classicMatchTotal}
          className="lg:hidden"
        />
        <YourPredictionsSection
          classicPredictions={predictions}
          poolId={poolId}
          memberId={memberId}
          currentUserId={currentUserId}
          scoringStyle={isPerMatchWinner ? 'winner' : scoringStyle}
          winnerPickMode={isPerMatchWinner}
          eventSport={eventSport}
          onPredictionSaved={onPredictionSaved}
          onPredictionRemoved={onPredictionRemoved}
        />
      </div>

      {!hideDesktopOverviewSidebar && inviteCode && poolId ? (
        <PoolPredictionsDesktopSidebar
          predictedCount={predictedMatchCount}
          totalMatchCount={classicMatchTotal}
          memberCount={memberCount}
          userRank={userRank}
          inviteCode={inviteCode}
          poolId={poolId}
          poolName={poolName}
          acceptingMembers={acceptingMembers}
          className="min-w-[12rem] max-w-[20rem] basis-[17.5rem] shrink-[3] grow-0"
        />
      ) : null}
    </div>
  )
}
