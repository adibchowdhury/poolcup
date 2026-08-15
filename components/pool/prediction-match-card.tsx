'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CompactMatchRowKickoffTime,
  CompactMatchRowScoreSeparator,
  CompactMatchRowReadOnlyScores,
  CompactMatchRowPredictedBadge,
  getCompactMatchRowContainerClassName,
  getCompactMatchRowScoreColumnClassName,
  getCompactMatchRowTeamsRowClassName,
  getPastMatchBodyTextClassName,
  getPastMatchMetaTextClassName,
  PredictScoreInput,
} from '@/components/predict/predict-match-row-shared'
import {
  CompactMatchRowTeamAway,
  CompactMatchRowTeamHome,
} from '@/components/predict/compact-match-row-teams'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { TbdSlot } from '@/components/predict/knockout-bracket-preview'
import { MatchPicksExpander } from '@/components/pool/match-picks-expander'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import { isKnockoutRound, type KnockoutRoundId } from '@/src/lib/classic-round-tab-logic'
import { isMatchLocked } from '@/src/lib/match-lock'
import {
  formatKnockoutPointValuesFooter,
  isPredictedDraw,
  knockoutWinnerPickHintText,
  knockoutWinnerPickLabel,
  resolveAdvancePickFromScores,
  resolveAdvancePickTeamName,
} from '@/src/lib/knockout-match-prediction'
import {
  clampPredictionScoreValue,
  deletePoolMatchPrediction,
  parsePredictionScores,
  upsertPoolMatchPrediction,
} from '@/src/lib/pool-match-prediction-write'
import {
  getPredictionOutcome,
  getPredictionOutcomeLabel,
  type MatchScoringStyle,
} from '@/src/lib/prediction-scoring'
import {
  getVoidMatchStatusLabel,
  getVoidPredictionOutcomeLabel,
  isVoidMatchStatus,
} from '@/src/lib/match-void-status'
import { capturePostHog, capturePredictionStarted } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { hasStoredClassicMatchPrediction } from '@/src/lib/merge-classic-match-predictions'
import { getClassicKnockoutPredictionDisplayOutcome } from '@/src/lib/classic-knockout-breakdown-lines'
import { hasClassicPredictionScores } from '@/src/lib/classic-prediction-progress'
import {
  usePredictionSaveContext,
  type PredictionSaveHandle,
  type PredictionSaveResult,
} from '@/components/pool/prediction-save-context'

export type UserPoolPrediction = {
  matchId: string
  kickoffAt: string
  lockedAt: string | null
  round: string
  groupName: string | null
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
  team1Logo?: string | null
  team2Logo?: string | null
  predTeam1: number | null
  predTeam2: number | null
  advancePick: number | null
  pointsAwarded: number | null
  advancingTeam: number | null
  resultTeam1: number | null
  resultTeam2: number | null
  isFinal: boolean
  /** API-Football short status (`PST`, `FT`, …). Used for void UI only. */
  statusShort: string | null
}

const ROUND_LABELS: Record<string, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  third: '3rd Place Playoff',
  final: 'Final',
}

const AUTOSAVE_DEBOUNCE_MS = 500
const SAVED_INDICATOR_MS = 2000

function formatRoundLabel(round: string, groupName: string | null): string {
  if (round === 'group' && groupName) {
    return `Group ${groupName}`
  }
  return ROUND_LABELS[round] ?? round
}

function parseOptionalScore(value: string): number | null {
  if (value === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function PreviewTbdTeamSide() {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:items-stretch">
      <TbdSlot />
    </div>
  )
}

function AdvanceTeamChip({
  teamName,
  dbFlag,
  logoUrl = null,
  selected,
  disabled,
  onClick,
}: {
  teamName: string
  dbFlag: string | null
  logoUrl?: string | null
  selected: boolean
  disabled: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        selected
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border bg-muted/40 text-foreground hover:border-primary/40',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <TeamFlagImage
        countryName={teamName}
        dbFlag={dbFlag}
        logoUrl={logoUrl}
        imgClassName="h-4 w-auto shrink-0 object-contain"
        emojiClassName="text-sm leading-none"
      />
      <span className="truncate">{teamName}</span>
    </button>
  )
}

export function KnockoutAdvancePicker({
  team1Name,
  team2Name,
  team1Flag,
  team2Flag,
  team1Logo = null,
  team2Logo = null,
  predTeam1,
  predTeam2,
  userAdvancePick,
  round = 'final',
  preview = false,
  isLocked = false,
  onAdvancePick,
}: {
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
  team1Logo?: string | null
  team2Logo?: string | null
  predTeam1: number | null
  predTeam2: number | null
  userAdvancePick: number | null
  round?: string
  preview?: boolean
  isLocked?: boolean
  onAdvancePick?: (pick: 1 | 2) => void
}) {
  if (!isKnockoutRound(round) && !preview) return null

  const hasScores = predTeam1 != null && predTeam2 != null
  if (!hasScores && !preview) return null

  const isDraw = hasScores && isPredictedDraw(predTeam1!, predTeam2!)
  const effectivePick = hasScores
    ? resolveAdvancePickFromScores(predTeam1!, predTeam2!, userAdvancePick)
    : null
  const pickEditable = isDraw && !isLocked && !preview && Boolean(onAdvancePick)

  return (
    <div className="flex w-full flex-col gap-2 border-t border-border/60 pt-2.5">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">
          {knockoutWinnerPickLabel(round)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {knockoutWinnerPickHintText(round, isDraw)}
        </p>
        {preview ? (
          <div className="flex gap-2">
            <AdvanceTeamChip
              teamName="TBD"
              dbFlag={null}
              selected={false}
              disabled
            />
            <AdvanceTeamChip
              teamName="TBD"
              dbFlag={null}
              selected={false}
              disabled
            />
          </div>
        ) : pickEditable ? (
          <div className="flex gap-2">
            <AdvanceTeamChip
              teamName={team1Name}
              dbFlag={team1Flag}
              logoUrl={team1Logo}
              selected={userAdvancePick === 1}
              disabled={false}
              onClick={() => onAdvancePick?.(1)}
            />
            <AdvanceTeamChip
              teamName={team2Name}
              dbFlag={team2Flag}
              logoUrl={team2Logo}
              selected={userAdvancePick === 2}
              disabled={false}
              onClick={() => onAdvancePick?.(2)}
            />
          </div>
        ) : effectivePick != null ? (
          <div className="flex gap-2">
            <AdvanceTeamChip
              teamName={
                effectivePick === 1 ? team1Name : team2Name
              }
              dbFlag={effectivePick === 1 ? team1Flag : team2Flag}
              logoUrl={effectivePick === 1 ? team1Logo : team2Logo}
              selected
              disabled
            />
            {!isDraw ? (
              <span className="flex min-w-0 flex-1 items-center justify-center text-[10px] text-muted-foreground">
                Implied by score
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function PredictionMatchCard({
  prediction,
  poolId,
  memberId,
  currentUserId,
  scoringStyle = 'classic',
  preview = false,
  previewSlotLabel,
  previewVenue,
  onPredictionSaved,
  onPredictionRemoved,
  autosave = false,
}: {
  prediction: UserPoolPrediction
  poolId?: string
  memberId?: string
  currentUserId?: string
  scoringStyle?: MatchScoringStyle
  preview?: boolean
  previewSlotLabel?: string
  previewVenue?: string
  onPredictionSaved?: (
    matchId: string,
    predTeam1: number,
    predTeam2: number,
    advancePick?: number | null,
  ) => void
  onPredictionRemoved?: (matchId: string) => void
  /** When true, debounced auto-save runs on edit. Default false — use the save bar. */
  autosave?: boolean
}) {
  const isKnockout = isKnockoutRound(prediction.round)
  const serverLocked = preview ? false : isMatchLocked(prediction.lockedAt)
  const { mounted, nowMs } = useClientNow(30_000)
  const hasKickedOff =
    !preview &&
    mounted &&
    new Date(prediction.kickoffAt).getTime() <= nowMs
  const [forceReadOnly, setForceReadOnly] = useState(false)
  const [lockedNotice, setLockedNotice] = useState(false)
  const isReadOnly = preview || serverLocked || forceReadOnly

  const [score1, setScore1] = useState(String(prediction.predTeam1 ?? ''))
  const [score2, setScore2] = useState(String(prediction.predTeam2 ?? ''))
  const [savedScore1, setSavedScore1] = useState(String(prediction.predTeam1 ?? ''))
  const [savedScore2, setSavedScore2] = useState(String(prediction.predTeam2 ?? ''))
  const [advancePick, setAdvancePick] = useState<number | null>(
    prediction.advancePick ?? null,
  )
  const [savedAdvancePick, setSavedAdvancePick] = useState<number | null>(
    prediction.advancePick ?? null,
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )
  const [saveError, setSaveError] = useState<string | null>(null)

  const saveInFlightRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoresRef = useRef({
    score1: String(prediction.predTeam1 ?? ''),
    score2: String(prediction.predTeam2 ?? ''),
    savedScore1: String(prediction.predTeam1 ?? ''),
    savedScore2: String(prediction.predTeam2 ?? ''),
    advancePick: prediction.advancePick ?? null,
    savedAdvancePick: prediction.advancePick ?? null,
  })

  scoresRef.current = {
    score1,
    score2,
    savedScore1,
    savedScore2,
    advancePick,
    savedAdvancePick,
  }

  useEffect(() => {
    const next1 = String(prediction.predTeam1 ?? '')
    const next2 = String(prediction.predTeam2 ?? '')
    const nextAdvance = prediction.advancePick ?? null
    const {
      score1: current1,
      score2: current2,
      savedScore1: prev1,
      savedScore2: prev2,
      advancePick: currentAdvance,
      savedAdvancePick: prevAdvance,
    } = scoresRef.current

    const serverSavedChanged =
      next1 !== prev1 || next2 !== prev2 || nextAdvance !== prevAdvance

    if (!serverSavedChanged) {
      return
    }

    setSavedScore1(next1)
    setSavedScore2(next2)
    setSavedAdvancePick(nextAdvance)

    const incomplete = (current1 === '') !== (current2 === '')
    const inputsMatchPrevSaved =
      current1 === prev1 &&
      current2 === prev2 &&
      currentAdvance === prevAdvance

    if (!incomplete && inputsMatchPrevSaved) {
      setScore1(next1)
      setScore2(next2)
      setAdvancePick(nextAdvance)
    }
  }, [
    prediction.predTeam1,
    prediction.predTeam2,
    prediction.advancePick,
    prediction.matchId,
  ])

  useEffect(() => {
    if (serverLocked && !forceReadOnly) {
      setScore1(savedScore1)
      setScore2(savedScore2)
      setAdvancePick(savedAdvancePick)
    }
  }, [serverLocked, forceReadOnly, savedScore1, savedScore2, savedAdvancePick])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
    }
  }, [])

  const hasStoredPrediction = hasStoredClassicMatchPrediction(prediction)

  const displayPredTeam1 = hasStoredPrediction
    ? isReadOnly
      ? prediction.predTeam1!
      : Number.parseInt(score1, 10) || 0
    : 0
  const displayPredTeam2 = hasStoredPrediction
    ? isReadOnly
      ? prediction.predTeam2!
      : Number.parseInt(score2, 10) || 0
    : 0

  const inputPredTeam1 = parseOptionalScore(score1)
  const inputPredTeam2 = parseOptionalScore(score2)
  const savedPredTeam1 = parseOptionalScore(savedScore1)
  const savedPredTeam2 = parseOptionalScore(savedScore2)

  const hasResult =
    prediction.isFinal &&
    prediction.resultTeam1 != null &&
    prediction.resultTeam2 != null

  const isVoidMatch = isVoidMatchStatus(prediction.statusShort)
  const voidMatchLabel = getVoidMatchStatusLabel(prediction.statusShort)

  const displayAdvancePick = isReadOnly ? prediction.advancePick : advancePick

  const earnedPointsLine:
    | {
        points: number
        label: string
        kind: 'exact' | 'draw' | 'winner' | 'advance' | 'wrong' | 'void'
      }
    | null = isVoidMatch
    ? hasStoredPrediction
      ? {
          points: 0,
          label: getVoidPredictionOutcomeLabel(),
          kind: 'void',
        }
      : null
    : hasResult && hasStoredPrediction
      ? isKnockout && scoringStyle === 'classic'
        ? (() => {
            const knockoutOutcome = getClassicKnockoutPredictionDisplayOutcome({
              round: prediction.round,
              predTeam1: displayPredTeam1,
              predTeam2: displayPredTeam2,
              advancePick: displayAdvancePick,
              resultTeam1: prediction.resultTeam1!,
              resultTeam2: prediction.resultTeam2!,
              advancingTeam: prediction.advancingTeam,
            })
            return {
              ...knockoutOutcome,
              points:
                prediction.pointsAwarded ?? knockoutOutcome.points,
            }
          })()
        : (() => {
            const groupOutcome = getPredictionOutcome(
              displayPredTeam1,
              displayPredTeam2,
              prediction.resultTeam1!,
              prediction.resultTeam2!,
              scoringStyle,
            )
            return {
              points: groupOutcome.points,
              label: getPredictionOutcomeLabel(groupOutcome.kind),
              kind: groupOutcome.kind,
            }
          })()
      : null

  const isEditable = !preview && Boolean(poolId && memberId) && !isReadOnly

  const saveContext = usePredictionSaveContext()
  const bumpDirty = saveContext?.bumpDirty

  const resolveAdvanceToSave = useCallback(
    (
      predTeam1: number,
      predTeam2: number,
      pick: number | null,
    ): number | null | undefined => {
      if (!isKnockout) return undefined
      if (isPredictedDraw(predTeam1, predTeam2)) {
        return pick === 1 || pick === 2 ? pick : null
      }
      return predTeam1 > predTeam2 ? 1 : 2
    },
    [isKnockout],
  )

  const computeIsDirty = useCallback((): boolean => {
    const score1Empty = score1 === ''
    const score2Empty = score2 === ''
    if (score1Empty !== score2Empty) return false

    if (score1Empty && score2Empty) {
      return savedScore1 !== '' && savedScore2 !== ''
    }

    const parsed = parsePredictionScores(score1, score2)
    if (!parsed) return false

    const advanceToSave = resolveAdvanceToSave(
      parsed.predTeam1,
      parsed.predTeam2,
      advancePick,
    )

    const scoresChanged =
      score1 !== savedScore1 ||
      score2 !== savedScore2

    let advanceChanged = false
    if (isKnockout) {
      const savedParsed = parsePredictionScores(savedScore1, savedScore2)
      const savedEffectiveAdvance =
        savedParsed != null
          ? resolveAdvancePickFromScores(
              savedParsed.predTeam1,
              savedParsed.predTeam2,
              savedAdvancePick,
            )
          : null
      advanceChanged = advanceToSave !== savedEffectiveAdvance
    }

    return scoresChanged || advanceChanged
  }, [
    advancePick,
    isKnockout,
    resolveAdvanceToSave,
    savedAdvancePick,
    savedScore1,
    savedScore2,
    score1,
    score2,
  ])

  const showPersistedCheck =
    !preview &&
    !isReadOnly &&
    !computeIsDirty() &&
    savedScore1 !== '' &&
    savedScore2 !== '' &&
    !saveError

  const savedCardComplete = showPersistedCheck

  const showPicksExpander =
    !preview && Boolean(poolId && currentUserId && hasKickedOff) && !isVoidMatch
  const showResultFooter = hasResult || showPicksExpander || isVoidMatch
  const pastMetaTextClassName = getPastMatchMetaTextClassName()
  const pastBodyTextClassName = getPastMatchBodyTextClassName()

  const knockoutPointFooter = isKnockout
    ? formatKnockoutPointValuesFooter(prediction.round as KnockoutRoundId)
    : null

  const showKnockoutAdvance =
    isKnockout &&
    (preview ||
      hasClassicPredictionScores(score1, score2) ||
      (isReadOnly && savedAdvancePick != null))

  const handleLockViolation = useCallback(() => {
    setForceReadOnly(true)
    setLockedNotice(true)
    setScore1(savedScore1)
    setScore2(savedScore2)
    setAdvancePick(savedAdvancePick)
    setSaveError('This match has locked')
    setSaveStatus('idle')
  }, [savedScore1, savedScore2, savedAdvancePick])

  const persistPrediction = useCallback(
    async (
      parsed: { predTeam1: number; predTeam2: number },
      nextAdvancePick: number | null | undefined,
    ): Promise<PredictionSaveResult> => {
      if (!poolId || !memberId || isReadOnly || saveInFlightRef.current) {
        return 'noop'
      }

      if (isMatchLocked(prediction.lockedAt)) {
        handleLockViolation()
        return 'locked'
      }

      saveInFlightRef.current = true
      setSaveStatus('saving')
      setSaveError(null)

      const result = await upsertPoolMatchPrediction(supabase, {
        poolId,
        memberId,
        matchId: prediction.matchId,
        predTeam1: parsed.predTeam1,
        predTeam2: parsed.predTeam2,
        advancePick: nextAdvancePick,
      })

      saveInFlightRef.current = false

      if (!result.ok) {
        if (result.isLockViolation) {
          handleLockViolation()
          return 'locked'
        }

        setSaveError('Could not save prediction. Try again.')
        setSaveStatus('idle')
        return 'error'
      }

      const next1 = String(parsed.predTeam1)
      const next2 = String(parsed.predTeam2)
      setSavedScore1(next1)
      setSavedScore2(next2)
      setScore1(next1)
      setScore2(next2)

      if (nextAdvancePick !== undefined) {
        setSavedAdvancePick(nextAdvancePick)
        setAdvancePick(nextAdvancePick)
      }

      setSaveStatus('saved')
      const wasEdit = savedScore1 !== '' && savedScore2 !== ''
      capturePostHog(wasEdit ? 'prediction_edited' : 'prediction_submitted', {
        pool_id: poolId,
        match_id: prediction.matchId,
      })
      void import('@/components/push/push-nudge-host').then(
        ({ markFirstPredictionForPushNudge }) => {
          markFirstPredictionForPushNudge()
        },
      )
      onPredictionSaved?.(
        prediction.matchId,
        parsed.predTeam1,
        parsed.predTeam2,
        nextAdvancePick !== undefined ? nextAdvancePick : savedAdvancePick,
      )

      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
      savedIndicatorRef.current = setTimeout(() => {
        setSaveStatus('idle')
      }, SAVED_INDICATOR_MS)

      saveContext?.bumpDirty()
      return 'ok'
    },
    [
      poolId,
      memberId,
      isReadOnly,
      prediction.matchId,
      prediction.lockedAt,
      handleLockViolation,
      onPredictionSaved,
      savedAdvancePick,
      saveContext,
    ],
  )

  const persistScores = useCallback(async (): Promise<PredictionSaveResult> => {
    if (!poolId || !memberId || isReadOnly || saveInFlightRef.current) {
      return 'noop'
    }

    if (isMatchLocked(prediction.lockedAt)) {
      handleLockViolation()
      return 'locked'
    }

    const score1Empty = score1 === ''
    const score2Empty = score2 === ''
    const bothEmpty = score1Empty && score2Empty
    const incomplete = score1Empty !== score2Empty

    if (incomplete) {
      return 'noop'
    }

    if (bothEmpty) {
      const hadSavedPrediction = savedScore1 !== '' && savedScore2 !== ''
      if (!hadSavedPrediction) {
        return 'noop'
      }

      saveInFlightRef.current = true
      setSaveStatus('saving')
      setSaveError(null)

      const result = await deletePoolMatchPrediction(supabase, {
        poolId,
        memberId,
        matchId: prediction.matchId,
      })

      saveInFlightRef.current = false

      if (!result.ok) {
        if (result.isLockViolation) {
          handleLockViolation()
          return 'locked'
        }

        setSaveError('Could not remove prediction. Try again.')
        setSaveStatus('idle')
        return 'error'
      }

      setSavedScore1('')
      setSavedScore2('')
      setScore1('')
      setScore2('')
      setSavedAdvancePick(null)
      setAdvancePick(null)
      setSaveStatus('idle')
      onPredictionRemoved?.(prediction.matchId)
      saveContext?.bumpDirty()
      return 'ok'
    }

    const parsed = parsePredictionScores(score1, score2)
    if (!parsed) return 'noop'

    const advanceToSave = resolveAdvanceToSave(
      parsed.predTeam1,
      parsed.predTeam2,
      advancePick,
    )

    const scoresUnchanged =
      parsed.predTeam1 === Number.parseInt(savedScore1, 10) &&
      parsed.predTeam2 === Number.parseInt(savedScore2, 10)
    const savedParsed = parsePredictionScores(savedScore1, savedScore2)
    const savedEffectiveAdvance =
      isKnockout && savedParsed != null
        ? resolveAdvancePickFromScores(
            savedParsed.predTeam1,
            savedParsed.predTeam2,
            savedAdvancePick,
          )
        : null
    const advanceUnchanged =
      !isKnockout || advanceToSave === savedEffectiveAdvance

    if (scoresUnchanged && advanceUnchanged) {
      return 'noop'
    }

    return persistPrediction(parsed, advanceToSave)
  }, [
    poolId,
    memberId,
    isReadOnly,
    isKnockout,
    score1,
    score2,
    savedScore1,
    savedScore2,
    advancePick,
    savedAdvancePick,
    prediction.matchId,
    prediction.lockedAt,
    handleLockViolation,
    onPredictionRemoved,
    persistPrediction,
    resolveAdvanceToSave,
    saveContext,
  ])

  const persistAdvancePick = useCallback(
    async (nextPick: 1 | 2) => {
      if (!poolId || !memberId || isReadOnly || saveInFlightRef.current) return

      const parsed = parsePredictionScores(savedScore1, savedScore2)
      if (!parsed || !isPredictedDraw(parsed.predTeam1, parsed.predTeam2)) return

      if (nextPick === savedAdvancePick) {
        return
      }

      await persistPrediction(parsed, nextPick)
    },
    [
      poolId,
      memberId,
      isReadOnly,
      savedScore1,
      savedScore2,
      savedAdvancePick,
      persistPrediction,
    ],
  )

  const scheduleAutosave = useCallback(() => {
    if (!autosave) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void persistScores()
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [autosave, persistScores])

  useEffect(() => {
    if (!saveContext || preview || !poolId || !memberId) return

    const handle: PredictionSaveHandle = {
      matchId: prediction.matchId,
      isDirty: computeIsDirty,
      isLocked: () => isReadOnly,
      save: persistScores,
    }

    return saveContext.register(handle)
  }, [
    saveContext,
    preview,
    poolId,
    memberId,
    prediction.matchId,
    computeIsDirty,
    isReadOnly,
    persistScores,
  ])

  useEffect(() => {
    if (!bumpDirty || preview || !poolId || !memberId) return
    bumpDirty()
  }, [
    bumpDirty,
    preview,
    poolId,
    memberId,
    score1,
    score2,
    advancePick,
    savedScore1,
    savedScore2,
    savedAdvancePick,
  ])

  const notifyDirty = useCallback(() => {
    bumpDirty?.()
  }, [bumpDirty])

  const handleScoreChange = (field: 'score1' | 'score2', raw: string) => {
    if (!preview && !isReadOnly && poolId) {
      capturePredictionStarted({
        match_id: prediction.matchId,
        pool_id: poolId,
      })
    }
    const clamped = clampPredictionScoreValue(raw)
    const nextScore1 = field === 'score1' ? clamped : score1
    const nextScore2 = field === 'score2' ? clamped : score2
    const nextPred1 = parseOptionalScore(nextScore1)
    const nextPred2 = parseOptionalScore(nextScore2)

    if (field === 'score1') {
      setScore1(clamped)
    } else {
      setScore2(clamped)
    }

    if (isKnockout && nextPred1 != null && nextPred2 != null) {
      if (!isPredictedDraw(nextPred1, nextPred2)) {
        setAdvancePick(nextPred1 > nextPred2 ? 1 : 2)
      } else {
        setAdvancePick(null)
      }
    }

    setSaveError(null)
    setSaveStatus('idle')
    notifyDirty()
    scheduleAutosave()
  }

  const handleBlur = () => {
    if (!autosave) return
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if ((score1 === '') !== (score2 === '')) {
      return
    }

    void persistScores()
  }

  const handleAdvancePick = (pick: 1 | 2) => {
    if (!isEditable || !hasClassicPredictionScores(score1, score2)) return
    const p1 = parseOptionalScore(score1)
    const p2 = parseOptionalScore(score2)
    if (p1 == null || p2 == null || !isPredictedDraw(p1, p2)) return

    setAdvancePick(pick)
    setSaveStatus('idle')
    setSaveError(null)
    notifyDirty()
    if (autosave) {
      void persistAdvancePick(pick)
    }
  }

  const actualAdvancedTeamName = resolveAdvancePickTeamName(
    prediction.advancingTeam,
    prediction.team1Name,
    prediction.team2Name,
  )

  return (
    <article className="flex w-full min-w-0 flex-col gap-2">
      <div
        className={cn(
          getCompactMatchRowContainerClassName({
            isLocked: isReadOnly && !preview,
            isPredicted: preview ? false : savedCardComplete,
            filled: preview ? false : savedCardComplete,
          }),
          'flex-col items-stretch gap-2.5',
          preview && 'opacity-95',
        )}
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              'rounded-md bg-muted px-2.5 py-1 text-xs font-medium',
              isReadOnly && !preview
                ? pastMetaTextClassName
                : 'text-muted-foreground',
            )}
          >
            {formatRoundLabel(prediction.round, prediction.groupName)}
          </span>
          {earnedPointsLine ? (
            <span
              className={cn(
                'text-xs font-semibold',
                earnedPointsLine.kind === 'exact'
                  ? 'text-primary'
                  : earnedPointsLine.kind === 'winner' ||
                      earnedPointsLine.kind === 'draw' ||
                      earnedPointsLine.kind === 'advance'
                    ? 'text-[#ffb300]'
                    : earnedPointsLine.kind === 'wrong'
                      ? 'text-destructive'
                      : earnedPointsLine.kind === 'void'
                        ? 'text-muted-foreground'
                        : pastMetaTextClassName,
              )}
            >
              {earnedPointsLine.kind === 'void'
                ? earnedPointsLine.label
                : `${earnedPointsLine.label} · +${earnedPointsLine.points} pts`}
            </span>
          ) : voidMatchLabel ? (
            <span className="text-xs font-semibold text-muted-foreground">
              {voidMatchLabel}
            </span>
          ) : (
            <CompactMatchRowKickoffTime
              kickoffAt={prediction.kickoffAt}
              isLocked={isReadOnly && !preview}
            />
          )}
        </div>

        <div className={getCompactMatchRowTeamsRowClassName()}>
          {preview ? (
            <PreviewTbdTeamSide />
          ) : (
            <CompactMatchRowTeamHome
              name={prediction.team1Name}
              dbFlag={prediction.team1Flag}
              logoUrl={prediction.team1Logo}
            />
          )}

          <div className={getCompactMatchRowScoreColumnClassName()}>
            {preview ? (
              <div className="flex items-center gap-1">
                <PredictScoreInput
                  value=""
                  onChange={() => undefined}
                  label="Home score preview"
                  filled={false}
                  disabled
                  readOnly
                />
                <CompactMatchRowScoreSeparator />
                <PredictScoreInput
                  value=""
                  onChange={() => undefined}
                  label="Away score preview"
                  filled={false}
                  disabled
                  readOnly
                />
              </div>
            ) : isEditable ? (
              <div className="flex items-center gap-1">
                <PredictScoreInput
                  value={score1}
                  onChange={(value) => handleScoreChange('score1', value)}
                  onBlur={handleBlur}
                  label={`${prediction.team1Name} score`}
                  filled={score1 !== ''}
                />
                <CompactMatchRowScoreSeparator />
                <PredictScoreInput
                  value={score2}
                  onChange={(value) => handleScoreChange('score2', value)}
                  onBlur={handleBlur}
                  label={`${prediction.team2Name} score`}
                  filled={score2 !== ''}
                />
              </div>
            ) : hasStoredPrediction ? (
              <CompactMatchRowReadOnlyScores
                score1={prediction.predTeam1!}
                score2={prediction.predTeam2!}
              />
            ) : hasResult ? (
              <span className={cn('text-center text-[10px]', pastMetaTextClassName)}>
                No prediction
              </span>
            ) : isReadOnly ? (
              <span
                className={cn(
                  'rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                  pastMetaTextClassName,
                )}
              >
                Locked
              </span>
            ) : null}
            {!preview ? (
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className={cn(
                    'text-[10px]',
                    isReadOnly ? pastMetaTextClassName : 'text-muted-foreground',
                  )}
                >
                  Your prediction
                </span>
                {saveStatus === 'saving' ? (
                  <span className="text-[10px] text-muted-foreground">Saving…</span>
                ) : saveStatus === 'saved' ? (
                  <span className="text-[10px] font-medium text-primary">Saved</span>
                ) : null}
                {saveError ? (
                  <span className="text-center text-[10px] text-destructive">
                    {saveError}
                  </span>
                ) : null}
                {lockedNotice ? (
                  <span className={cn('text-center text-[10px]', pastMetaTextClassName)}>
                    This match has locked
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {preview ? (
            <PreviewTbdTeamSide />
          ) : (
            <CompactMatchRowTeamAway
              name={prediction.team2Name}
              dbFlag={prediction.team2Flag}
              logoUrl={prediction.team2Logo}
            />
          )}
        </div>

        {preview && previewSlotLabel ? (
          <p className="text-center text-[11px] text-muted-foreground">
            {previewSlotLabel}
          </p>
        ) : null}

        {preview && previewVenue ? (
          <p className="hidden text-center text-[10px] text-muted-foreground/80 sm:block">
            {previewVenue}
          </p>
        ) : null}

        {showKnockoutAdvance ? (
          <div className="flex w-full flex-col gap-2">
            <KnockoutAdvancePicker
              team1Name={prediction.team1Name}
              team2Name={prediction.team2Name}
              team1Flag={prediction.team1Flag}
              team2Flag={prediction.team2Flag}
              team1Logo={prediction.team1Logo}
              team2Logo={prediction.team2Logo}
              predTeam1={inputPredTeam1}
              predTeam2={inputPredTeam2}
              userAdvancePick={advancePick}
              round={prediction.round}
              preview={preview}
              isLocked={isReadOnly}
              onAdvancePick={isEditable ? handleAdvancePick : undefined}
            />
            {knockoutPointFooter ? (
              <p className="text-center text-[10px] text-muted-foreground">
                {knockoutPointFooter}
              </p>
            ) : null}
          </div>
        ) : null}

        {showResultFooter ? (
          <div className="flex w-full flex-col gap-2 border-t border-border/60 pt-2.5">
            {isVoidMatch && voidMatchLabel ? (
              <p className={cn('text-center text-xs', pastMetaTextClassName)}>
                {voidMatchLabel}
                {hasStoredPrediction ? ' · Prediction voided' : ''}
              </p>
            ) : hasResult ? (
              <p className={cn('text-center text-xs', pastBodyTextClassName)}>
                Actual: {prediction.resultTeam1} – {prediction.resultTeam2}
                {actualAdvancedTeamName
                  ? ` · Advanced: ${actualAdvancedTeamName}`
                  : ''}
              </p>
            ) : null}

            {showPicksExpander ? (
              <MatchPicksExpander
                poolId={poolId!}
                matchId={prediction.matchId}
                scoringStyle={scoringStyle}
                kickoffAt={prediction.kickoffAt}
                isFinal={prediction.isFinal}
                resultTeam1={prediction.resultTeam1}
                resultTeam2={prediction.resultTeam2}
                round={prediction.round}
                advancingTeam={prediction.advancingTeam}
                currentUserId={currentUserId!}
                team1Name={prediction.team1Name}
                team2Name={prediction.team2Name}
                team1Flag={prediction.team1Flag}
                team2Flag={prediction.team2Flag}
                team1Logo={prediction.team1Logo}
                team2Logo={prediction.team2Logo}
              />
            ) : null}
          </div>
        ) : null}

        {!preview ? (
          <CompactMatchRowPredictedBadge
            isPredicted={savedCardComplete}
            filled={savedCardComplete}
            isLocked={isReadOnly}
          />
        ) : null}
      </div>
    </article>
  )
}
