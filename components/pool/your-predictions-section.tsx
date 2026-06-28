'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ClassicRoundTabs,
  type ClassicRoundTabId,
} from '@/components/predict/group-knockout-tabs'
import {
  classicRoundTabEmptyMessage,
  matchInClassicRoundTab,
  resolveDefaultClassicRoundTabForPredictions,
} from '@/src/lib/classic-round-tab-logic'
import { hasStoredClassicMatchPrediction } from '@/src/lib/merge-classic-match-predictions'
import {
  type ClassicPredictionSortMode,
  sortClassicPredictions,
} from '@/src/lib/sort-classic-predictions'
import { normalizeMatchScoringStyle } from '@/src/lib/prediction-scoring'
import {
  PredictionMatchCard,
  type UserPoolPrediction,
} from '@/components/pool/prediction-match-card'
import { ClassicR32PreviewTab } from '@/components/predict/classic-r32-preview-tab'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CLASSIC_SORT_OPTIONS: {
  value: ClassicPredictionSortMode
  label: string
}[] = [
  { value: 'kickoff-newest', label: 'Kickoff: newest' },
  { value: 'kickoff-oldest', label: 'Kickoff: oldest' },
  { value: 'group', label: 'Group' },
  { value: 'status', label: 'Status' },
]

/** Used by pool page data loading for winner pool progress checks. */
export type WinnerGroupPrediction = {
  groupName: string
  standings: string[]
}

type YourPredictionsSectionProps = {
  classicPredictions: UserPoolPrediction[]
  poolId?: string
  currentUserId?: string
  memberId?: string
  onPredictionSaved?: (
    matchId: string,
    predTeam1: number,
    predTeam2: number,
    advancePick?: number | null,
  ) => void
  onPredictionRemoved?: (matchId: string) => void
}

export function YourPredictionsSection({
  classicPredictions,
  poolId,
  memberId,
  currentUserId,
  onPredictionSaved,
  onPredictionRemoved,
}: YourPredictionsSectionProps) {
  const matchScoringStyle = normalizeMatchScoringStyle('classic')
  const hasClassicContent = classicPredictions.length > 0
  const [activeRoundTab, setActiveRoundTab] = useState<ClassicRoundTabId>('group')
  const defaultRoundTabSetRef = useRef(false)
  const [classicSortMode, setClassicSortMode] =
    useState<ClassicPredictionSortMode>('kickoff-newest')

  useEffect(() => {
    const predictedClassicPredictions = classicPredictions.filter(
      hasStoredClassicMatchPrediction,
    )
    if (defaultRoundTabSetRef.current || predictedClassicPredictions.length === 0) {
      return
    }

    setActiveRoundTab(
      resolveDefaultClassicRoundTabForPredictions(predictedClassicPredictions),
    )
    defaultRoundTabSetRef.current = true
  }, [classicPredictions])

  const stageFilteredPredictions = useMemo(
    () =>
      classicPredictions.filter((prediction) =>
        matchInClassicRoundTab(prediction.round, activeRoundTab),
      ),
    [classicPredictions, activeRoundTab],
  )

  const orderedClassicPredictions = useMemo(
    () => sortClassicPredictions(stageFilteredPredictions, classicSortMode),
    [stageFilteredPredictions, classicSortMode],
  )

  return (
    <section className="mt-8 w-full min-w-0 border-t border-border/80 pt-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <h3 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
          Your predictions
        </h3>
        {hasClassicContent ? (
          <div className="flex items-center gap-2">
            <label
              htmlFor="classic-predictions-sort"
              className="text-sm text-muted-foreground"
            >
              Sort by
            </label>
            <Select
              value={classicSortMode}
              onValueChange={(value) =>
                setClassicSortMode(value as ClassicPredictionSortMode)
              }
            >
              <SelectTrigger
                id="classic-predictions-sort"
                size="sm"
                className="min-w-[9.5rem] border-border bg-card text-foreground"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSIC_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {hasClassicContent ? (
        <div className="mb-4 min-w-0">
          <ClassicRoundTabs
            activeId={activeRoundTab}
            onChange={setActiveRoundTab}
          />
        </div>
      ) : null}

      {orderedClassicPredictions.length === 0 ? (
        activeRoundTab === 'r32' ? (
          <ClassicR32PreviewTab />
        ) : (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            {classicRoundTabEmptyMessage(activeRoundTab)}
          </p>
        )
      ) : (
        <ul className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2">
          {orderedClassicPredictions.map((prediction) => (
            <li key={prediction.matchId} className="min-w-0">
              <PredictionMatchCard
                prediction={prediction}
                poolId={poolId}
                memberId={memberId}
                currentUserId={currentUserId}
                scoringStyle={matchScoringStyle}
                onPredictionSaved={onPredictionSaved}
                onPredictionRemoved={onPredictionRemoved}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
