'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ClassicRoundTabs,
  type ClassicRoundTabId,
} from '@/components/predict/group-knockout-tabs'
import { ClassicR32PreviewTab } from '@/components/predict/classic-r32-preview-tab'
import { ProgressHeader } from '@/components/predict/progress-header'
import { SaveBar } from '@/components/predict/save-bar'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import {
  PredictionSaveProvider,
  usePredictionSaveCoordinator,
} from '@/components/pool/prediction-save-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MOBILE_SAVE_BAR_SCROLL_PAD_ABOVE_NAV_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import {
  classicMatchTotalCount,
  countClassicPredictedScores,
} from '@/src/lib/classic-prediction-progress'
import {
  classicRoundTabEmptyMessage,
  matchInClassicRoundTab,
  resolveDefaultClassicRoundTabForPredictions,
} from '@/src/lib/classic-round-tab-logic'
import {
  type ClassicPredictionSortMode,
  sortClassicPredictions,
} from '@/src/lib/sort-classic-predictions'
import { fetchClassicPredictionsMobile } from '../lib/fetch-classic-predictions-mobile'
import { supabase } from '../lib/supabase-mobile'
import { MobileClassicPredictionCard } from './mobile-classic-prediction-card'

const CLASSIC_SORT_OPTIONS: {
  value: ClassicPredictionSortMode
  label: string
}[] = [
  { value: 'kickoff-newest', label: 'Kickoff: newest' },
  { value: 'kickoff-oldest', label: 'Kickoff: oldest' },
  { value: 'group', label: 'Group' },
  { value: 'status', label: 'Status' },
]

type MobileClassicPredictionsReadonlyProps = {
  poolId: string
  memberId: string
}

function ClassicStageSaveBar({
  activeMatchIds,
  onSaveComplete,
}: {
  activeMatchIds: string[]
  onSaveComplete: () => Promise<void>
}) {
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
    if (unsavedCount === 0) return

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const result = await saveAll()
    setSaving(false)

    if (result.ok > 0 || result.locked > 0) {
      await onSaveComplete()
    }

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
  }, [onSaveComplete, saveAll, unsavedCount])

  return (
    <SaveBar
      unsavedCount={unsavedCount}
      saving={saving}
      success={saveSuccess}
      error={saveError}
      disabled={unsavedCount === 0}
      onSave={() => void handleSave()}
      stackAboveMobileNav
    />
  )
}

export function MobileClassicPredictionsReadonly({
  poolId,
  memberId,
}: MobileClassicPredictionsReadonlyProps) {
  const [predictions, setPredictions] = useState<UserPoolPrediction[]>([])
  const [totalMatchCount, setTotalMatchCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRoundTab, setActiveRoundTab] = useState<ClassicRoundTabId>('group')
  const defaultRoundTabSetRef = useRef(false)
  const [classicSortMode, setClassicSortMode] =
    useState<ClassicPredictionSortMode>('kickoff-newest')

  const loadPredictions = useCallback(async () => {
    setLoading(true)
    setError(null)

    const result = await fetchClassicPredictionsMobile(
      supabase,
      poolId,
      memberId,
    )

    setPredictions(result.predictions)
    setTotalMatchCount(result.totalMatchCount)
    setError(result.error)
    setLoading(false)
    defaultRoundTabSetRef.current = false
  }, [poolId, memberId])

  useEffect(() => {
    void loadPredictions()
  }, [loadPredictions])

  useEffect(() => {
    if (defaultRoundTabSetRef.current || predictions.length === 0) {
      return
    }

    setActiveRoundTab(resolveDefaultClassicRoundTabForPredictions(predictions))
    defaultRoundTabSetRef.current = true
  }, [predictions])

  const handlePredictionSaved = useCallback(
    (
      matchId: string,
      predTeam1: number,
      predTeam2: number,
      advancePick?: number | null,
    ) => {
      setPredictions((previous) =>
        previous.map((row) =>
          row.matchId === matchId
            ? {
                ...row,
                predTeam1,
                predTeam2,
                advancePick: advancePick ?? row.advancePick,
              }
            : row,
        ),
      )
    },
    [],
  )

  const handlePredictionRemoved = useCallback((matchId: string) => {
    setPredictions((previous) =>
      previous.map((row) =>
        row.matchId === matchId
          ? {
              ...row,
              predTeam1: null,
              predTeam2: null,
              advancePick: null,
            }
          : row,
      ),
    )
  }, [])

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

  const stageFilteredPredictions = useMemo(
    () =>
      predictions.filter((prediction) =>
        matchInClassicRoundTab(prediction.round, activeRoundTab),
      ),
    [predictions, activeRoundTab],
  )

  const orderedClassicPredictions = useMemo(
    () => sortClassicPredictions(stageFilteredPredictions, classicSortMode),
    [stageFilteredPredictions, classicSortMode],
  )

  const activeMatchIds = useMemo(
    () => stageFilteredPredictions.map((prediction) => prediction.matchId),
    [stageFilteredPredictions],
  )

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading predictions…</p>
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    )
  }

  return (
    <PredictionSaveProvider>
      <div
        className={
          predictions.length > 0 && activeMatchIds.length > 0
            ? MOBILE_SAVE_BAR_SCROLL_PAD_ABOVE_NAV_CLASS
            : undefined
        }
      >
        <div className="w-full min-w-0 space-y-4">
          <ProgressHeader
            current={predictedMatchCount}
            total={classicMatchTotal}
          />

          <div>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
              <h3 className="font-display text-xl tracking-wide text-foreground">
                Your predictions
              </h3>
              {predictions.length > 0 ? (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="mobile-classic-predictions-sort"
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
                      id="mobile-classic-predictions-sort"
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

            {predictions.length > 0 ? (
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
              <ul className="grid min-w-0 grid-cols-1 gap-3">
                {orderedClassicPredictions.map((prediction) => (
                  <li key={prediction.matchId} className="min-w-0">
                    <MobileClassicPredictionCard
                      prediction={prediction}
                      poolId={poolId}
                      memberId={memberId}
                      onPredictionSaved={handlePredictionSaved}
                      onPredictionRemoved={handlePredictionRemoved}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {predictions.length > 0 && activeMatchIds.length > 0 ? (
          <ClassicStageSaveBar
            activeMatchIds={activeMatchIds}
            onSaveComplete={loadPredictions}
          />
        ) : null}
      </div>
    </PredictionSaveProvider>
  )
}
