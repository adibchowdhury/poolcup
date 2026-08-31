'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  ClassicRoundTabs,
  type ClassicRoundTabId,
} from '@/components/predict/group-knockout-tabs'
import { SaveBar } from '@/components/predict/save-bar'
import { SAVE_BAR_SOLO_SCROLL_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
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
import { sportAllowsDraw } from '@/src/lib/winner-pick-storage'
import {
  hasClassicPredictionScores,
} from '@/src/lib/classic-prediction-progress'
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
import { MatchesTabGroupHeader } from '@/components/dashboard/matches-tab-grouped-sections'
import { buildDateHorizonGroups } from '@/src/lib/matches-tab-date-groups'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PredictionSortControl,
  PredictionStatusFilterSegmented,
  usePoolPredictionStatusFilterOptional,
  type PredictionStatusFilter,
} from '@/src/lib/pool-prediction-status-filter-context'

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

function predictionHasPick(prediction: UserPoolPrediction): boolean {
  return hasClassicPredictionScores(
    String(prediction.predTeam1 ?? ''),
    String(prediction.predTeam2 ?? ''),
  )
}

/** Matches Tailwind `lg:` — only one predictions list may mount (save handles are per matchId). */
const LG_UP_MQ = '(min-width: 1024px)'

function subscribeLgUp(onChange: () => void) {
  const mql = window.matchMedia(LG_UP_MQ)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getLgUpSnapshot() {
  return window.matchMedia(LG_UP_MQ).matches
}

function getLgUpServerSnapshot() {
  return false
}

function predictionIsCompleted(prediction: UserPoolPrediction): boolean {
  return (
    getMatchLifecycleSection({
      statusShort: prediction.statusShort,
      isFinal: prediction.isFinal,
      kickoffAt: prediction.kickoffAt,
    }) === 'completed'
  )
}

function matchesStatusFilter(
  prediction: UserPoolPrediction,
  filter: PredictionStatusFilter,
): boolean {
  const completed = predictionIsCompleted(prediction)
  const hasPick = predictionHasPick(prediction)
  if (filter === 'all') return true
  if (filter === 'completed') return completed
  if (filter === 'unpicked') return !completed && !hasPick
  return !completed && hasPick
}

function ClassicStageSaveBar({
  activeMatchIds,
  onVisibleChange,
}: {
  activeMatchIds: string[]
  onVisibleChange?: (visible: boolean) => void
}) {
  const { unsavedCount, saveAll } = usePredictionSaveCoordinator(activeMatchIds)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const barVisible =
    unsavedCount > 0 || saving || saveSuccess || Boolean(saveError)

  useEffect(() => {
    onVisibleChange?.(barVisible)
  }, [barVisible, onVisibleChange])

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
      visible={barVisible}
      onSave={() => void handleSave()}
      stackAboveMobileNav={false}
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
  scoringStyle?: string
  winnerPickMode?: boolean
  eventSport?: string | null
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
  scoringStyle = 'classic',
  winnerPickMode = false,
  eventSport = null,
  onPredictionSaved,
  onPredictionRemoved,
}: YourPredictionsSectionProps) {
  const matchScoringStyle = normalizeMatchScoringStyle(scoringStyle)
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
  const filterCtx = usePoolPredictionStatusFilterOptional()
  const [localSortMode, setLocalSortMode] =
    useState<ClassicPredictionSortMode>('kickoff-oldest')
  const classicSortMode = filterCtx?.sortMode ?? localSortMode
  const setClassicSortMode = filterCtx?.setSortMode ?? setLocalSortMode
  const [localStatusFilter, setLocalStatusFilter] =
    useState<PredictionStatusFilter>('all')
  const statusFilter = filterCtx?.statusFilter ?? localStatusFilter
  const setStatusFilter = filterCtx?.setStatusFilter ?? setLocalStatusFilter
  const setFilterCounts = filterCtx?.setCounts
  const setShowFilters = filterCtx?.setShowFilters
  const setSortOptions = filterCtx?.setSortOptions
  const isLgUp = useSyncExternalStore(
    subscribeLgUp,
    getLgUpSnapshot,
    getLgUpServerSnapshot,
  )

  useEffect(() => {
    if (seasonMode) {
      if (classicSortMode === 'group') setClassicSortMode('kickoff-oldest')
      return
    }
    if (mixedPlayoffMode) {
      if (classicSortMode === 'group') setClassicSortMode('kickoff-oldest')
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
  }, [
    classicPredictions,
    classicSortMode,
    mixedPlayoffMode,
    seasonMode,
    setClassicSortMode,
  ])

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

  const statusFilterCounts = useMemo(() => {
    let unpicked = 0
    let predicted = 0
    let completed = 0
    for (const prediction of stageFilteredPredictions) {
      if (predictionIsCompleted(prediction)) {
        completed += 1
      } else if (predictionHasPick(prediction)) {
        predicted += 1
      } else {
        unpicked += 1
      }
    }
    return {
      all: stageFilteredPredictions.length,
      unpicked,
      predicted,
      completed,
    }
  }, [stageFilteredPredictions])

  const showCompletedFilter = statusFilterCounts.completed > 0

  useEffect(() => {
    if (statusFilter === 'completed' && !showCompletedFilter) {
      setStatusFilter('all')
    }
  }, [showCompletedFilter, setStatusFilter, statusFilter])

  useEffect(() => {
    if (!setFilterCounts || !setShowFilters) return
    setFilterCounts({
      all: statusFilterCounts.all,
      unpicked: statusFilterCounts.unpicked,
      predicted: statusFilterCounts.predicted,
      completed: statusFilterCounts.completed,
    })
    setShowFilters(hasClassicContent)
    return () => {
      setShowFilters(false)
    }
  }, [
    setFilterCounts,
    setShowFilters,
    hasClassicContent,
    statusFilterCounts.all,
    statusFilterCounts.unpicked,
    statusFilterCounts.predicted,
    statusFilterCounts.completed,
  ])

  const statusFilteredPredictions = useMemo(
    () =>
      stageFilteredPredictions.filter((prediction) =>
        matchesStatusFilter(prediction, statusFilter),
      ),
    [stageFilteredPredictions, statusFilter],
  )

  const orderedClassicPredictions = useMemo(
    () => sortClassicPredictions(statusFilteredPredictions, classicSortMode),
    [statusFilteredPredictions, classicSortMode],
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

  const dateHorizonGroups = useMemo(
    () =>
      buildDateHorizonGroups(statusFilteredPredictions, {
        getKickoffAt: (prediction) => prediction.kickoffAt,
        getLifecycleFields: (prediction) => ({
          statusShort: prediction.statusShort,
          isFinal: prediction.isFinal,
          kickoffAt: prediction.kickoffAt,
        }),
      }),
    [statusFilteredPredictions],
  )

  const dateGroupIdsKey = useMemo(
    () => dateHorizonGroups.map((group) => group.id).join('\0'),
    [dateHorizonGroups],
  )

  /** Per-visit defaults: first group expanded, rest collapsed. No persistence. */
  const [expandedDateGroupIds, setExpandedDateGroupIds] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    const firstId = dateGroupIdsKey ? dateGroupIdsKey.split('\0')[0] : null
    setExpandedDateGroupIds(firstId ? new Set([firstId]) : new Set())
  }, [dateGroupIdsKey])

  const [saveBarVisible, setSaveBarVisible] = useState(false)

  const activeMatchIds = useMemo(
    () => statusFilteredPredictions.map((prediction) => prediction.matchId),
    [statusFilteredPredictions],
  )

  const sortOptions =
    seasonMode || mixedPlayoffMode ? SEASON_SORT_OPTIONS : CLASSIC_SORT_OPTIONS

  useEffect(() => {
    if (!setSortOptions) return
    setSortOptions(sortOptions)
  }, [setSortOptions, sortOptions])

  const matchListClassName =
    'grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2'

  const renderPredictionCard = (prediction: UserPoolPrediction) => (
    <PredictionMatchCard
      prediction={prediction}
      poolId={poolId}
      memberId={memberId}
      currentUserId={currentUserId}
      scoringStyle={matchScoringStyle}
      winnerPickMode={winnerPickMode}
      allowDraw={sportAllowsDraw(eventSport)}
      autosave={winnerPickMode}
      onPredictionSaved={onPredictionSaved}
      onPredictionRemoved={onPredictionRemoved}
    />
  )

  const desktopDateGroupedList =
    dateHorizonGroups.length > 0 ? (
      <div className="space-y-6 lg:space-y-8">
        {dateHorizonGroups.map((group) => {
          const isExpanded = expandedDateGroupIds.has(group.id)
          return (
            <section key={group.id} aria-label={group.label} className="min-w-0">
              <MatchesTabGroupHeader
                label={group.label}
                count={group.matches.length}
                showLiveDot={group.showLiveDot}
                showCount={false}
                expanded={isExpanded}
                onToggle={() => {
                  setExpandedDateGroupIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(group.id)) next.delete(group.id)
                    else next.add(group.id)
                    return next
                  })
                }}
              />
              {isExpanded ? (
                <div className="pool-predictions-desktop-grid grid min-w-0 items-start">
                  {group.matches.map((prediction) => (
                    <div key={prediction.matchId} className="min-w-0">
                      {renderPredictionCard(prediction)}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    ) : null

  const mobilePredictionsList =
    mixedPlayoffMode && seasonPlayoffPhase === 'playoffs' ? (
      <MlsPlayoffStageSections
        items={orderedClassicPredictions}
        getKickoffMs={(prediction) => new Date(prediction.kickoffAt).getTime()}
        getKey={(prediction) => prediction.matchId}
        listClassName={matchListClassName}
        renderMatch={renderPredictionCard}
      />
    ) : (
      <MatchLifecycleSections
        buckets={lifecycleBuckets}
        getKey={(prediction) => prediction.matchId}
        listClassName={matchListClassName}
        renderItem={renderPredictionCard}
      />
    )

  return (
    <PredictionSaveProvider>
      <section
        className={cn(
          'mt-8 w-full min-w-0 border-t border-border/80 pt-8 lg:mt-0 lg:border-t-0 lg:pt-0',
          hasClassicContent &&
            activeMatchIds.length > 0 &&
            saveBarVisible
            ? SAVE_BAR_SOLO_SCROLL_PAD_CLASS
            : undefined,
        )}
      >
      {/* 1. Page title */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <h3 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
          Your predictions
        </h3>
        {hasClassicContent ? (
          <div className="flex items-center gap-2 lg:hidden">
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

      {/* 2. Tournament stage (highest-level filter) — above status/sort on desktop */}
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

      {/* 3. Status filters + Sort (desktop) */}
      {hasClassicContent ? (
        <div className="mb-4 hidden items-center justify-between gap-3 lg:flex">
          <PredictionStatusFilterSegmented />
          <PredictionSortControl
            hideLabel
            className="w-[11rem] shrink-0 space-y-0 border-t-0 p-0 pt-0"
          />
        </div>
      ) : null}

      {orderedClassicPredictions.length === 0 ? (
        seasonMode ? (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? 'No matches scheduled yet.'
              : 'No matches in this filter.'}
          </p>
        ) : mixedPlayoffMode && seasonPlayoffPhase === 'season' ? (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? 'No regular-season matches scheduled yet.'
              : 'No matches in this filter.'}
          </p>
        ) : mixedPlayoffMode && seasonPlayoffPhase === 'playoffs' ? (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? 'No playoff matches scheduled yet.'
              : 'No matches in this filter.'}
          </p>
        ) : activeRoundTab === 'r32' && statusFilter === 'all' ? (
          <ClassicR32PreviewTab />
        ) : (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? classicRoundTabEmptyMessage(activeRoundTab)
              : 'No matches in this filter.'}
          </p>
        )
      ) : mixedPlayoffMode && seasonPlayoffPhase === 'playoffs' ? (
        isLgUp ? (
          desktopDateGroupedList
        ) : (
          mobilePredictionsList
        )
      ) : isLgUp ? (
        desktopDateGroupedList
      ) : (
        mobilePredictionsList
      )}

      {hasClassicContent && activeMatchIds.length > 0 ? (
        <ClassicStageSaveBar
          activeMatchIds={activeMatchIds}
          onVisibleChange={setSaveBarVisible}
        />
      ) : null}
    </section>
    </PredictionSaveProvider>
  )
}
