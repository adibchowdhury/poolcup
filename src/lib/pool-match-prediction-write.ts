import type { SupabaseClient } from '@supabase/supabase-js'

/** Mirrors predict page score clamping (0–20, non-negative integers). */
export function clampPredictionScoreValue(value: string): string {
  if (value === '') return ''
  const num = Number.parseInt(value, 10)
  if (Number.isNaN(num)) return ''
  return String(Math.min(20, Math.max(0, num)))
}

export type ParsedPredictionScores = {
  predTeam1: number
  predTeam2: number
}

export function parsePredictionScores(
  score1: string,
  score2: string,
): ParsedPredictionScores | null {
  const clamped1 = clampPredictionScoreValue(score1)
  const clamped2 = clampPredictionScoreValue(score2)
  if (clamped1 === '' || clamped2 === '') return null

  return {
    predTeam1: Number.parseInt(clamped1, 10),
    predTeam2: Number.parseInt(clamped2, 10),
  }
}

export type UpsertPoolMatchPredictionParams = {
  poolId: string
  memberId: string
  matchId: string
  predTeam1: number
  predTeam2: number
  advancePick?: number | null
}

/** Same upsert path as app/pool/[invite_code]/predict/page.tsx handleSave. */
export async function upsertPoolMatchPrediction(
  supabase: SupabaseClient,
  params: UpsertPoolMatchPredictionParams,
): Promise<
  { ok: true } | { ok: false; error: string; isLockViolation: boolean }
> {
  const { error } = await supabase.from('predictions').upsert(
    {
      pool_id: params.poolId,
      member_id: params.memberId,
      match_id: params.matchId,
      pred_team1: params.predTeam1,
      pred_team2: params.predTeam2,
      ...(params.advancePick !== undefined
        ? { advance_pick: params.advancePick }
        : {}),
    },
    { onConflict: 'pool_id,member_id,match_id' },
  )

  if (error) {
    return {
      ok: false,
      error: error.message,
      isLockViolation: isPredictionLockPolicyError(error.message),
    }
  }

  return { ok: true }
}

export type DeletePoolMatchPredictionParams = {
  poolId: string
  memberId: string
  matchId: string
}

export async function deletePoolMatchPrediction(
  supabase: SupabaseClient,
  params: DeletePoolMatchPredictionParams,
): Promise<
  { ok: true } | { ok: false; error: string; isLockViolation: boolean }
> {
  const { error } = await supabase
    .from('predictions')
    .delete()
    .eq('pool_id', params.poolId)
    .eq('member_id', params.memberId)
    .eq('match_id', params.matchId)

  if (error) {
    return {
      ok: false,
      error: error.message,
      isLockViolation: isPredictionLockPolicyError(error.message),
    }
  }

  return { ok: true }
}

function isPredictionLockPolicyError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('row-level security') ||
    lower.includes('violates') ||
    lower.includes('policy') ||
    lower.includes('locked')
  )
}
