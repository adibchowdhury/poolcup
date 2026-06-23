'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
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
import { WORLD_CUP_GROUP_LETTERS } from '@/src/lib/world-cup-groups'

const CLASSIC_SORT_OPTIONS: {
  value: ClassicPredictionSortMode
  label: string
}[] = [
  { value: 'kickoff-newest', label: 'Kickoff: newest' },
  { value: 'kickoff-oldest', label: 'Kickoff: oldest' },
  { value: 'group', label: 'Group' },
  { value: 'status', label: 'Status' },
]

export type WinnerGroupPrediction = {
  groupName: string
  standings: string[]
}

type YourPredictionsSectionProps = {
  scoringStyle: string
  classicPredictions: UserPoolPrediction[]
  winnerGroups: WinnerGroupPrediction[]
  thirdPlaceTeams: string[]
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

function GroupRankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold',
        rank <= 2 && 'bg-primary/20 text-primary',
        rank === 3 && 'bg-amber-500/20 text-amber-400',
        rank === 4 && 'bg-muted text-muted-foreground',
      )}
    >
      {rank}
    </span>
  )
}

function WinnerGroupCard({ group }: { group: WinnerGroupPrediction }) {
  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-3 sm:p-4">
      <h4 className="mb-2.5 font-display text-base tracking-wide text-foreground">
        Group {group.groupName}
      </h4>
      <ol className="space-y-1.5">
        {group.standings.map((team, index) => {
          const rank = index + 1
          return (
            <li
              key={`${group.groupName}-${team}-${index}`}
              className={cn(
                'flex min-w-0 items-center gap-2.5 text-sm',
                rank === 4 && 'opacity-75',
              )}
            >
              <GroupRankBadge rank={rank} />
              <span className="truncate font-medium text-foreground">{team}</span>
            </li>
          )
        })}
      </ol>
    </article>
  )
}

function ThirdPlaceCard({ teams }: { teams: string[] }) {
  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-3 sm:p-4">
      <h4 className="mb-2.5 font-display text-base tracking-wide text-foreground">
        Best third-place teams
      </h4>
      <ol className="space-y-1.5">
        {teams.map((team, index) => (
          <li
            key={`third-${team}-${index}`}
            className="flex min-w-0 items-center gap-2.5 text-sm"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-mono text-xs font-semibold text-amber-400">
              {index + 1}
            </span>
            <span className="truncate font-medium text-foreground">{team}</span>
          </li>
        ))}
      </ol>
    </article>
  )
}

export function YourPredictionsSection({
  scoringStyle,
  classicPredictions,
  winnerGroups,
  thirdPlaceTeams,
  poolId,
  memberId,
  currentUserId,
  onPredictionSaved,
  onPredictionRemoved,
}: YourPredictionsSectionProps) {
  const isWinnerOnly = scoringStyle === 'winner'
  const matchScoringStyle = normalizeMatchScoringStyle(scoringStyle)
  const hasWinnerContent = winnerGroups.length > 0 || thirdPlaceTeams.length > 0
  const hasClassicContent = classicPredictions.length > 0
  const totalGroups = WORLD_CUP_GROUP_LETTERS.length
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
        {isWinnerOnly ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-primary">{winnerGroups.length}</span>
            {' of '}
            <span className="font-medium text-foreground">{totalGroups}</span>
            {' groups predicted'}
          </p>
        ) : hasClassicContent ? (
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

      {hasClassicContent && !isWinnerOnly ? (
        <div className="mb-4 min-w-0">
          <ClassicRoundTabs
            activeId={activeRoundTab}
            onChange={setActiveRoundTab}
          />
        </div>
      ) : null}

      {isWinnerOnly && !hasWinnerContent ? (
        <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing saved yet. Use Make Predictions above to get started.
        </p>
      ) : isWinnerOnly ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
          {winnerGroups.map((group) => (
            <WinnerGroupCard key={group.groupName} group={group} />
          ))}
          {thirdPlaceTeams.length > 0 ? (
            <ThirdPlaceCard teams={thirdPlaceTeams} />
          ) : null}
        </div>
      ) : orderedClassicPredictions.length === 0 ? (
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
