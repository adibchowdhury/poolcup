'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ClassicRoundTabs,
  type ClassicRoundTabId,
} from '@/components/predict/group-knockout-tabs'
import { SaveBar } from '@/components/predict/save-bar'
import {
  MOBILE_SAVE_BAR_SCROLL_PAD_ABOVE_NAV_CLASS,
} from '@/src/lib/mobile-bottom-nav-routes'
import {
  classicRoundTabEmptyMessage,
  isTournamentStyleMatches,
  matchInClassicRoundTab,
  resolveDefaultClassicRoundTabForPredictions,
} from '@/src/lib/classic-round-tab-logic'
import {
  hasMlsPlayoffRounds,
  isMlsPlayoffRound,
  isSeasonFlatRound,
} from '@/src/lib/mls-playoff-rounds'
import {
  SeasonPlayoffTabs,
  type SeasonPlayoffPhaseId,
} from '@/components/predict/season-playoff-tabs'
import { MlsPlayoffStageSections } from '@/components/predict/mls-playoff-stage-sections'
import {
  type ClassicPredictionSortMode,
  sortClassicPredictions,
} from '@/src/lib/sort-classic-predictions'
import { normalizeMatchScoringStyle } from '@/src/lib/prediction-scoring'
import {
  getMatchLifecycleSection,
  partitionByLifecycleSection,
} from '@/src/lib/match-lifecycle-section'
import {
  PredictionMatchCard,
  type UserPoolPrediction,
} from '@/components/pool/prediction-match-card'
import {
  PredictionSaveProvider,
  usePredictionSaveCoordinator,
} from '@/components/pool/prediction-save-context'
import { cn } from '@/lib/utils'
import { ClassicR32PreviewTab } from '@/components/predict/classic-r32-preview-tab'
import { MatchLifecycleSections } from '@/components/predict/match-lifecycle-sections'
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

const SEASON_SORT_OPTIONS = CLASSIC_SORT_OPTIONS.filter(
  (option) => option.value !== 'group',
)

function ClassicStageSaveBar({ activeMatchIds }: { activeMatchIds: string[] }) {
  const { unsavedCount, saveAll } = usePredictionSaveCoordinator(activeMatchIds)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (unsavedCount > 0) {
      setSaveError(null)
    }
  }, [unsavedCount])

  const handleSave = useCallback(async () => {
    if (unsavedCount === 0 && !saveError) return

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const result = await saveAll()
    setSaving(false)

    if (result.error > 0) {
      setSaveError(
        result.locked > 0
          ? 'Some matches have locked'
          : "Couldn't save predictions",
      )
      return
    }

    if (result.locked > 0 && result.ok === 0) {
      setSaveError('This match has locked')
      return
    }

    if (result.ok > 0) {
      setSaveSuccess(true)
      window.setTimeout(() => setSaveSuccess(false), 2000)
    }
  }, [saveAll, saveError, unsavedCount])

  return (
    <SaveBar
      unsavedCount={unsavedCount}
      saving={saving}
      success={saveSuccess}
      error={saveError}
      disabled={unsavedCount === 0}
      onSave={() => void handleSave()}
    />
  )
}

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
  const tournamentMode = useMemo(
    () =>
      classicPredictions.length > 0 &&
      isTournamentStyleMatches(classicPredictions),
    [classicPredictions],
  )
  const mixedPlayoffMode = useMemo(
    () =>
      classicPredictions.length > 0 &&
      !tournamentMode &&
      hasMlsPlayoffRounds(classicPredictions),
    [classicPredictions, tournamentMode],
  )
  const seasonMode = useMemo(
    () =>
      classicPredictions.length > 0 &&
      !tournamentMode &&
      !mixedPlayoffMode,
    [classicPredictions, mixedPlayoffMode, tournamentMode],
  )
  const [activeRoundTab, setActiveRoundTab] = useState<ClassicRoundTabId>('group')
  const [seasonPlayoffPhase, setSeasonPlayoffPhase] =
    useState<SeasonPlayoffPhaseId>('season')
  const defaultRoundTabSetRef = useRef(false)
  const [classicSortMode, setClassicSortMode] =
    useState<ClassicPredictionSortMode>('kickoff-oldest')

  useEffect(() => {
    if (seasonMode) {
      setClassicSortMode((prev) => (prev === 'group' ? 'kickoff-oldest' : prev))
      return
    }
    if (mixedPlayoffMode) {
      setClassicSortMode((prev) => (prev === 'group' ? 'kickoff-oldest' : prev))
      setSeasonPlayoffPhase(
        classicPredictions.some((prediction) =>
          isSeasonFlatRound(prediction.round),
        )
          ? 'season'
          : 'playoffs',
      )
      return
    }
    if (defaultRoundTabSetRef.current || classicPredictions.length === 0) {
      return
    }

    setActiveRoundTab(
      resolveDefaultClassicRoundTabForPredictions(classicPredictions),
    )
    defaultRoundTabSetRef.current = true
  }, [classicPredictions, mixedPlayoffMode, seasonMode])

  const stageFilteredPredictions = useMemo(() => {
    if (seasonMode) return classicPredictions
    if (mixedPlayoffMode) {
      return seasonPlayoffPhase === 'playoffs'
        ? classicPredictions.filter((prediction) =>
            isMlsPlayoffRound(prediction.round),
          )
        : classicPredictions.filter((prediction) =>
            isSeasonFlatRound(prediction.round),
          )
    }
    return classicPredictions.filter((prediction) =>
      matchInClassicRoundTab(prediction.round, activeRoundTab),
    )
  }, [
    activeRoundTab,
    classicPredictions,
    mixedPlayoffMode,
    seasonMode,
    seasonPlayoffPhase,
  ])

  const orderedClassicPredictions = useMemo(
    () => sortClassicPredictions(stageFilteredPredictions, classicSortMode),
    [stageFilteredPredictions, classicSortMode],
  )

  const lifecycleBuckets = useMemo(
    () =>
      partitionByLifecycleSection(orderedClassicPredictions, (prediction) =>
        getMatchLifecycleSection({
          statusShort: prediction.statusShort,
          isFinal: prediction.isFinal,
          kickoffAt: prediction.kickoffAt,
        }),
      ),
    [orderedClassicPredictions],
  )

  const activeMatchIds = useMemo(
    () => stageFilteredPredictions.map((prediction) => prediction.matchId),
    [stageFilteredPredictions],
  )

  const sortOptions =
    seasonMode || mixedPlayoffMode ? SEASON_SORT_OPTIONS : CLASSIC_SORT_OPTIONS

  return (
    <PredictionSaveProvider>
      <section
        className={cn(
          'mt-8 w-full min-w-0 border-t border-border/80 pt-8',
          hasClassicContent && activeMatchIds.length > 0
            ? MOBILE_SAVE_BAR_SCROLL_PAD_ABOVE_NAV_CLASS
            : undefined,
        )}
      >
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
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {hasClassicContent && mixedPlayoffMode ? (
        <div className="mb-4 min-w-0">
          <SeasonPlayoffTabs
            activeId={seasonPlayoffPhase}
            onChange={setSeasonPlayoffPhase}
          />
        </div>
      ) : null}

      {hasClassicContent && !seasonMode && !mixedPlayoffMode ? (
        <div className="mb-4 min-w-0">
          <ClassicRoundTabs
            activeId={activeRoundTab}
            onChange={setActiveRoundTab}
          />
        </div>
      ) : null}

      {orderedClassicPredictions.length === 0 ? (
        seasonMode ? (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            No matches scheduled yet.
          </p>
        ) : mixedPlayoffMode && seasonPlayoffPhase === 'season' ? (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            No regular-season matches scheduled yet.
          </p>
        ) : mixedPlayoffMode && seasonPlayoffPhase === 'playoffs' ? (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            No playoff matches scheduled yet.
          </p>
        ) : activeRoundTab === 'r32' ? (
          <ClassicR32PreviewTab />
        ) : (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            {classicRoundTabEmptyMessage(activeRoundTab)}
          </p>
        )
      ) : mixedPlayoffMode && seasonPlayoffPhase === 'playoffs' ? (
        <MlsPlayoffStageSections
          items={orderedClassicPredictions}
          getKickoffMs={(prediction) => new Date(prediction.kickoffAt).getTime()}
          getKey={(prediction) => prediction.matchId}
          renderMatch={(prediction) => (
            <div className="grid min-w-0 grid-cols-1">
              <PredictionMatchCard
                prediction={prediction}
                poolId={poolId}
                memberId={memberId}
                currentUserId={currentUserId}
                scoringStyle={matchScoringStyle}
                onPredictionSaved={onPredictionSaved}
                onPredictionRemoved={onPredictionRemoved}
              />
            </div>
          )}
        />
      ) : (
        <MatchLifecycleSections
          buckets={lifecycleBuckets}
          getKey={(prediction) => prediction.matchId}
          listClassName="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2"
          renderItem={(prediction) => (
            <PredictionMatchCard
              prediction={prediction}
              poolId={poolId}
              memberId={memberId}
              currentUserId={currentUserId}
              scoringStyle={matchScoringStyle}
              onPredictionSaved={onPredictionSaved}
              onPredictionRemoved={onPredictionRemoved}
            />
          )}
        />
      )}

      {hasClassicContent && activeMatchIds.length > 0 ? (
        <ClassicStageSaveBar activeMatchIds={activeMatchIds} />
      ) : null}
    </section>
    </PredictionSaveProvider>
  )
}
