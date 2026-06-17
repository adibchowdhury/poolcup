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
import { MatchPicksExpander } from '@/components/pool/match-picks-expander'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import { isMatchLocked } from '@/src/lib/match-lock'
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
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { hasStoredClassicMatchPrediction } from '@/src/lib/merge-classic-match-predictions'
import { hasClassicPredictionScores } from '@/src/lib/classic-prediction-progress'

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
  predTeam1: number | null
  predTeam2: number | null
  resultTeam1: number | null
  resultTeam2: number | null
  isFinal: boolean
}

const ROUND_LABELS: Record<string, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
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

export function PredictionMatchCard({
  prediction,
  poolId,
  memberId,
  currentUserId,
  scoringStyle = 'classic',
  onPredictionSaved,
  onPredictionRemoved,
}: {
  prediction: UserPoolPrediction
  poolId?: string
  memberId?: string
  currentUserId?: string
  scoringStyle?: MatchScoringStyle
  onPredictionSaved?: (
    matchId: string,
    predTeam1: number,
    predTeam2: number,
  ) => void
  onPredictionRemoved?: (matchId: string) => void
}) {
  const serverLocked = isMatchLocked(prediction.lockedAt)
  const { mounted, nowMs } = useClientNow(30_000)
  const hasKickedOff =
    mounted && new Date(prediction.kickoffAt).getTime() <= nowMs
  const [forceReadOnly, setForceReadOnly] = useState(false)
  const [lockedNotice, setLockedNotice] = useState(false)
  const isReadOnly = serverLocked || forceReadOnly

  const [score1, setScore1] = useState(String(prediction.predTeam1 ?? ''))
  const [score2, setScore2] = useState(String(prediction.predTeam2 ?? ''))
  const [savedScore1, setSavedScore1] = useState(String(prediction.predTeam1 ?? ''))
  const [savedScore2, setSavedScore2] = useState(String(prediction.predTeam2 ?? ''))
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )

  const saveInFlightRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoresRef = useRef({
    score1: String(prediction.predTeam1 ?? ''),
    score2: String(prediction.predTeam2 ?? ''),
    savedScore1: String(prediction.predTeam1 ?? ''),
    savedScore2: String(prediction.predTeam2 ?? ''),
  })

  scoresRef.current = { score1, score2, savedScore1, savedScore2 }

  useEffect(() => {
    const next1 = String(prediction.predTeam1 ?? '')
    const next2 = String(prediction.predTeam2 ?? '')
    const { score1: current1, score2: current2, savedScore1: prev1, savedScore2: prev2 } =
      scoresRef.current

    const serverSavedChanged = next1 !== prev1 || next2 !== prev2

    setSavedScore1(next1)
    setSavedScore2(next2)

    if (!serverSavedChanged) {
      return
    }

    const incomplete = (current1 === '') !== (current2 === '')
    const inputsMatchPrevSaved = current1 === prev1 && current2 === prev2

    if (!incomplete && inputsMatchPrevSaved) {
      setScore1(next1)
      setScore2(next2)
    }
  }, [prediction.predTeam1, prediction.predTeam2, prediction.matchId])

  useEffect(() => {
    if (serverLocked && !forceReadOnly) {
      setScore1(savedScore1)
      setScore2(savedScore2)
    }
  }, [serverLocked, forceReadOnly, savedScore1, savedScore2])

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

  const hasResult =
    prediction.isFinal &&
    prediction.resultTeam1 != null &&
    prediction.resultTeam2 != null

  const outcome =
    hasResult && hasStoredPrediction
      ? getPredictionOutcome(
          displayPredTeam1,
          displayPredTeam2,
          prediction.resultTeam1!,
          prediction.resultTeam2!,
          scoringStyle,
        )
      : null

  const isEditable = Boolean(poolId && memberId) && !isReadOnly
  const savedScoresFilled = savedScore1 !== '' && savedScore2 !== ''
  const inputsShowPredicted = hasClassicPredictionScores(score1, score2)
  const showPicksExpander = Boolean(poolId && currentUserId && hasKickedOff)
  const showCardFooter = hasResult || showPicksExpander
  const pastMetaTextClassName = getPastMatchMetaTextClassName()
  const pastBodyTextClassName = getPastMatchBodyTextClassName()

  const persistScores = useCallback(async () => {
    if (!poolId || !memberId || isReadOnly || saveInFlightRef.current) return

    const score1Empty = score1 === ''
    const score2Empty = score2 === ''
    const bothEmpty = score1Empty && score2Empty
    const incomplete = score1Empty !== score2Empty

    if (incomplete) {
      return
    }

    if (bothEmpty) {
      const hadSavedPrediction = savedScore1 !== '' && savedScore2 !== ''
      if (!hadSavedPrediction) {
        return
      }

      saveInFlightRef.current = true
      setSaveStatus('saving')

      const result = await deletePoolMatchPrediction(supabase, {
        poolId,
        memberId,
        matchId: prediction.matchId,
      })

      saveInFlightRef.current = false

      if (!result.ok) {
        if (result.isLockViolation) {
          setForceReadOnly(true)
          setLockedNotice(true)
          setScore1(savedScore1)
          setScore2(savedScore2)
          setSaveStatus('idle')
          return
        }

        setSaveStatus('idle')
        return
      }

      setSavedScore1('')
      setSavedScore2('')
      setScore1('')
      setScore2('')
      setSaveStatus('idle')
      onPredictionRemoved?.(prediction.matchId)
      return
    }

    const parsed = parsePredictionScores(score1, score2)
    if (!parsed) return

    if (
      parsed.predTeam1 === Number.parseInt(savedScore1, 10) &&
      parsed.predTeam2 === Number.parseInt(savedScore2, 10)
    ) {
      return
    }

    saveInFlightRef.current = true
    setSaveStatus('saving')

    const result = await upsertPoolMatchPrediction(supabase, {
      poolId,
      memberId,
      matchId: prediction.matchId,
      predTeam1: parsed.predTeam1,
      predTeam2: parsed.predTeam2,
    })

    saveInFlightRef.current = false

    if (!result.ok) {
      if (result.isLockViolation) {
        setForceReadOnly(true)
        setLockedNotice(true)
        setScore1(savedScore1)
        setScore2(savedScore2)
        setSaveStatus('idle')
        return
      }

      setSaveStatus('idle')
      return
    }

    const next1 = String(parsed.predTeam1)
    const next2 = String(parsed.predTeam2)
    setSavedScore1(next1)
    setSavedScore2(next2)
    setScore1(next1)
    setScore2(next2)
    setSaveStatus('saved')
    capturePostHog('prediction_submitted', {
      pool_id: poolId,
      match_id: prediction.matchId,
    })
    onPredictionSaved?.(prediction.matchId, parsed.predTeam1, parsed.predTeam2)

    if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
    savedIndicatorRef.current = setTimeout(() => {
      setSaveStatus('idle')
    }, SAVED_INDICATOR_MS)
  }, [
    poolId,
    memberId,
    isReadOnly,
    score1,
    score2,
    savedScore1,
    savedScore2,
    prediction.matchId,
    onPredictionSaved,
    onPredictionRemoved,
  ])

  const scheduleAutosave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void persistScores()
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [persistScores])

  const handleScoreChange = (field: 'score1' | 'score2', raw: string) => {
    const clamped = clampPredictionScoreValue(raw)
    if (field === 'score1') {
      setScore1(clamped)
    } else {
      setScore2(clamped)
    }
    setSaveStatus('idle')
    scheduleAutosave()
  }

  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if ((score1 === '') !== (score2 === '')) {
      return
    }

    void persistScores()
  }

  return (
    <article className="flex w-full min-w-0 flex-col gap-2">
      <div
        className={cn(
          getCompactMatchRowContainerClassName({
            isLocked: isReadOnly,
            isPredicted: savedScoresFilled,
            filled: savedScoresFilled,
          }),
          'flex-col items-stretch gap-2.5',
        )}
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              'rounded-md bg-muted px-2.5 py-1 text-xs font-medium',
              isReadOnly ? pastMetaTextClassName : 'text-muted-foreground',
            )}
          >
            {formatRoundLabel(prediction.round, prediction.groupName)}
          </span>
          {outcome ? (
            <span
              className={cn(
                'text-xs font-semibold',
                outcome.kind === 'exact'
                  ? 'text-primary'
                  : outcome.kind === 'winner'
                    ? 'text-[#ffb300]'
                    : pastMetaTextClassName,
              )}
            >
              {getPredictionOutcomeLabel(outcome.kind)} · +{outcome.points} pts
            </span>
          ) : (
            <CompactMatchRowKickoffTime
              kickoffAt={prediction.kickoffAt}
              isLocked={isReadOnly}
            />
          )}
        </div>

        <div className={getCompactMatchRowTeamsRowClassName()}>
          <CompactMatchRowTeamHome
            name={prediction.team1Name}
            dbFlag={prediction.team1Flag}
          />

          <div className={getCompactMatchRowScoreColumnClassName()}>
            {isEditable ? (
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

        {showCardFooter ? (
          <div className="flex w-full flex-col gap-2 border-t border-border/60 pt-2.5">
            {hasResult ? (
              <p className={cn('text-center text-xs', pastBodyTextClassName)}>
                Actual: {prediction.resultTeam1} – {prediction.resultTeam2}
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
                currentUserId={currentUserId!}
              />
            ) : null}
          </div>
        ) : null}

        <CompactMatchRowPredictedBadge
          isPredicted={inputsShowPredicted}
          filled={inputsShowPredicted}
          isLocked={isReadOnly}
        />
      </div>
    </article>
  )
}
