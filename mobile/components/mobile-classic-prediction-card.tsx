'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  CompactMatchRowKickoffTime,
  CompactMatchRowReadOnlyScores,
  CompactMatchRowScoreSeparator,
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
import {
  KnockoutAdvancePicker,
  type UserPoolPrediction,
} from '@/components/pool/prediction-match-card'
import {
  usePredictionSaveContext,
  type PredictionSaveResult,
} from '@/components/pool/prediction-save-context'
import { cn } from '@/lib/utils'
import {
  isKnockoutRound,
  type KnockoutRoundId,
} from '@/src/lib/classic-round-tab-logic'
import { hasStoredClassicMatchPrediction } from '@/src/lib/merge-classic-match-predictions'
import { isMatchLocked } from '@/src/lib/match-lock'
import {
  formatKnockoutPointValuesFooter,
  isPredictedDraw,
  resolveAdvancePickFromScores,
} from '@/src/lib/knockout-match-prediction'
import { hasClassicPredictionScores } from '@/src/lib/classic-prediction-progress'
import {
  clampPredictionScoreValue,
  deletePoolMatchPrediction,
  parsePredictionScores,
  upsertPoolMatchPrediction,
} from '@/src/lib/pool-match-prediction-write'
import { supabase } from '../lib/supabase-mobile'

const ROUND_LABELS: Record<string, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  third: '3rd Place Playoff',
  final: 'Final',
}

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

type MobileClassicPredictionCardProps = {
  prediction: UserPoolPrediction
  poolId: string
  memberId: string
  onPredictionSaved?: (
    matchId: string,
    predTeam1: number,
    predTeam2: number,
    advancePick?: number | null,
  ) => void
  onPredictionRemoved?: (matchId: string) => void
}

export function MobileClassicPredictionCard({
  prediction,
  poolId,
  memberId,
  onPredictionSaved,
  onPredictionRemoved,
}: MobileClassicPredictionCardProps) {
  const isKnockout = isKnockoutRound(prediction.round)
  const serverLocked = isMatchLocked(prediction.lockedAt)
  const [forceReadOnly, setForceReadOnly] = useState(false)
  const [lockedNotice, setLockedNotice] = useState(false)
  const isReadOnly = serverLocked || forceReadOnly

  const hasResult =
    prediction.isFinal &&
    prediction.resultTeam1 != null &&
    prediction.resultTeam2 != null

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const saveInFlightRef = useRef(false)
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

  const saveContext = usePredictionSaveContext()
  const bumpDirty = saveContext?.bumpDirty

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

    const scoresChanged = score1 !== savedScore1 || score2 !== savedScore2

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
      if (isReadOnly || saveInFlightRef.current) {
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
      onPredictionSaved?.(
        prediction.matchId,
        parsed.predTeam1,
        parsed.predTeam2,
        nextAdvancePick !== undefined ? nextAdvancePick : savedAdvancePick,
      )

      window.setTimeout(() => setSaveStatus('idle'), 2000)
      saveContext?.bumpDirty()
      return 'ok'
    },
    [
      handleLockViolation,
      isReadOnly,
      memberId,
      onPredictionSaved,
      poolId,
      prediction.matchId,
      prediction.lockedAt,
      saveContext,
      savedAdvancePick,
    ],
  )

  const persistScores = useCallback(async (): Promise<PredictionSaveResult> => {
    if (isReadOnly || saveInFlightRef.current) {
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
    advancePick,
    handleLockViolation,
    isKnockout,
    isReadOnly,
    memberId,
    onPredictionRemoved,
    persistPrediction,
    poolId,
    prediction.matchId,
    prediction.lockedAt,
    resolveAdvanceToSave,
    saveContext,
    savedAdvancePick,
    savedScore1,
    savedScore2,
    score1,
    score2,
  ])

  useEffect(() => {
    if (!saveContext) return

    const handle = {
      matchId: prediction.matchId,
      isDirty: computeIsDirty,
      isLocked: () => isReadOnly,
      save: persistScores,
    }

    return saveContext.register(handle)
  }, [
    saveContext,
    prediction.matchId,
    computeIsDirty,
    isReadOnly,
    persistScores,
  ])

  useEffect(() => {
    if (!bumpDirty) return
    bumpDirty()
  }, [
    bumpDirty,
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
    if (isReadOnly) return

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
  }

  const handleAdvancePick = (pick: 1 | 2) => {
    if (isReadOnly || !hasClassicPredictionScores(score1, score2)) return
    const p1 = parseOptionalScore(score1)
    const p2 = parseOptionalScore(score2)
    if (p1 == null || p2 == null || !isPredictedDraw(p1, p2)) return

    setAdvancePick(pick)
    setSaveStatus('idle')
    setSaveError(null)
    notifyDirty()
  }

  const predTeam1 = parseOptionalScore(score1)
  const predTeam2 = parseOptionalScore(score2)
  const filled =
    hasClassicPredictionScores(score1, score2) ||
    (!isReadOnly && hasStoredClassicMatchPrediction({
      predTeam1: prediction.predTeam1,
      predTeam2: prediction.predTeam2,
    }))

  const pastMetaTextClassName = getPastMatchMetaTextClassName()
  const pastBodyTextClassName = getPastMatchBodyTextClassName()
  const knockoutPointFooter = isKnockout
    ? formatKnockoutPointValuesFooter(prediction.round as KnockoutRoundId)
    : null

  const showKnockoutAdvance =
    isKnockout &&
    (hasClassicPredictionScores(score1, score2) ||
      (isReadOnly && prediction.advancePick != null))

  return (
    <article
      className={getCompactMatchRowContainerClassName({
        isLocked: isReadOnly,
        isPredicted: filled,
        filled,
      })}
    >
      <div className="flex w-full min-w-0 items-center justify-between gap-2">
        <span className={cn('text-xs font-semibold', pastMetaTextClassName)}>
          {formatRoundLabel(prediction.round, prediction.groupName)}
        </span>
        <CompactMatchRowKickoffTime
          kickoffAt={prediction.kickoffAt}
          isLocked={isReadOnly}
        />
      </div>

      <div className={getCompactMatchRowTeamsRowClassName()}>
        <CompactMatchRowTeamHome
          name={prediction.team1Name}
          dbFlag={prediction.team1Flag}
        />

        <div className={getCompactMatchRowScoreColumnClassName()}>
          {isReadOnly ? (
            hasStoredClassicMatchPrediction({
              predTeam1: prediction.predTeam1,
              predTeam2: prediction.predTeam2,
            }) ? (
              <CompactMatchRowReadOnlyScores
                score1={prediction.predTeam1!}
                score2={prediction.predTeam2!}
              />
            ) : hasResult ? (
              <span className={cn('text-center text-[10px]', pastMetaTextClassName)}>
                No prediction
              </span>
            ) : (
              <span
                className={cn(
                  'rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                  pastMetaTextClassName,
                )}
              >
                Locked
              </span>
            )
          ) : (
            <div className="flex items-center gap-1">
              <PredictScoreInput
                value={score1}
                onChange={(value) => handleScoreChange('score1', value)}
                label={`${prediction.team1Name} score`}
                filled={score1 !== ''}
              />
              <CompactMatchRowScoreSeparator />
              <PredictScoreInput
                value={score2}
                onChange={(value) => handleScoreChange('score2', value)}
                label={`${prediction.team2Name} score`}
                filled={score2 !== ''}
              />
            </div>
          )}
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
        </div>

        <CompactMatchRowTeamAway
          name={prediction.team2Name}
          dbFlag={prediction.team2Flag}
        />
      </div>

      {showKnockoutAdvance ? (
        <KnockoutAdvancePicker
          team1Name={prediction.team1Name}
          team2Name={prediction.team2Name}
          team1Flag={prediction.team1Flag}
          team2Flag={prediction.team2Flag}
          predTeam1={isReadOnly ? prediction.predTeam1 : predTeam1}
          predTeam2={isReadOnly ? prediction.predTeam2 : predTeam2}
          userAdvancePick={isReadOnly ? prediction.advancePick : advancePick}
          round={prediction.round}
          isLocked={isReadOnly}
          onAdvancePick={isReadOnly ? undefined : handleAdvancePick}
        />
      ) : null}

      {hasResult ? (
        <p className={cn('text-center text-xs', pastBodyTextClassName)}>
          Final: {prediction.resultTeam1}–{prediction.resultTeam2}
          {prediction.pointsAwarded != null && prediction.pointsAwarded > 0
            ? ` · +${prediction.pointsAwarded} pts`
            : null}
        </p>
      ) : null}

      {knockoutPointFooter && !isReadOnly ? (
        <p className="text-center text-[10px] text-muted-foreground">
          {knockoutPointFooter}
        </p>
      ) : null}
    </article>
  )
}
