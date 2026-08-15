import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dispatch, SetStateAction } from 'react'
import { capturePostHog } from '@/src/lib/posthog-client'
import { upsertPoolMatchPrediction } from '@/src/lib/pool-match-prediction-write'
import {
  advancePickScores,
  isR32MatchLocked,
  type R32BracketMatchesByNumber,
} from '@/src/lib/winner-only-r32-bracket'

export type SaveKnockoutAdvancePicksResult = {
  savedCount: number
  lockedCount: number
  errorCount: number
}

/** Persist unsaved advance_pick rows for a knockout round (R16, QF, SF, Final). */
export async function saveWinnerKnockoutAdvancePicks(
  supabase: SupabaseClient,
  poolId: string,
  memberId: string,
  matchesByNumber: R32BracketMatchesByNumber,
  nowMs: number,
  setMatchesByNumber: Dispatch<SetStateAction<R32BracketMatchesByNumber>>,
): Promise<SaveKnockoutAdvancePicksResult> {
  let savedCount = 0
  let lockedCount = 0
  let errorCount = 0

  for (const match of matchesByNumber.values()) {
    if (match.myPick === match.savedPick) continue

    if (isR32MatchLocked(match, nowMs)) {
      lockedCount += 1
      setMatchesByNumber((prev) => {
        const next = new Map(prev)
        const existing = next.get(match.matchNumber)
        if (!existing) return prev
        next.set(match.matchNumber, {
          ...existing,
          myPick: existing.savedPick,
        })
        return next
      })
      continue
    }

    if (match.myPick !== 1 && match.myPick !== 2) {
      continue
    }

    const scores = advancePickScores(match.myPick)
    const result = await upsertPoolMatchPrediction(supabase, {
      poolId,
      memberId,
      matchId: match.matchId,
      predTeam1: scores.predTeam1,
      predTeam2: scores.predTeam2,
      advancePick: match.myPick,
    })

    if (!result.ok) {
      if (result.isLockViolation) {
        lockedCount += 1
        setMatchesByNumber((prev) => {
          const next = new Map(prev)
          const existing = next.get(match.matchNumber)
          if (!existing) return prev
          next.set(match.matchNumber, {
            ...existing,
            myPick: existing.savedPick,
          })
          return next
        })
      } else {
        errorCount += 1
      }
      continue
    }

    setMatchesByNumber((prev) => {
      const next = new Map(prev)
      const existing = next.get(match.matchNumber)
      if (!existing) return prev
      next.set(match.matchNumber, {
        ...existing,
        savedPick: match.myPick,
      })
      return next
    })
    savedCount += 1
    capturePostHog(
      match.savedPick === 1 || match.savedPick === 2
        ? 'prediction_edited'
        : 'prediction_submitted',
      {
        pool_id: poolId,
        match_id: match.matchId,
      },
    )
  }

  return { savedCount, lockedCount, errorCount }
}
