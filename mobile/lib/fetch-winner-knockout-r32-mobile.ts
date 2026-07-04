import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchWinnerKnockoutRoundMatches } from '@/src/lib/fetch-winner-knockout-round'
import type {
  R32BracketMatchesByNumber,
} from '@/src/lib/winner-only-r32-bracket'

export type WinnerKnockoutR32MobileData = {
  matchesByNumber: R32BracketMatchesByNumber
  error: string | null
}

/** READ-ONLY: loads R32 matches and member advance_pick predictions. */
export async function fetchWinnerKnockoutR32Mobile(
  supabase: SupabaseClient,
  poolId: string,
  memberId: string,
): Promise<WinnerKnockoutR32MobileData> {
  const { matchesByNumber, error } = await fetchWinnerKnockoutRoundMatches(
    supabase,
    'r32',
    poolId,
    memberId,
  )
  return { matchesByNumber, error }
}

export type WinnerKnockoutR16MobileData = {
  matchesByNumber: R32BracketMatchesByNumber
  error: string | null
}

/** READ-ONLY: loads R16 matches and member advance_pick predictions. */
export async function fetchWinnerKnockoutR16Mobile(
  supabase: SupabaseClient,
  poolId: string,
  memberId: string,
): Promise<WinnerKnockoutR16MobileData> {
  const { matchesByNumber, error } = await fetchWinnerKnockoutRoundMatches(
    supabase,
    'r16',
    poolId,
    memberId,
  )
  return { matchesByNumber, error }
}
