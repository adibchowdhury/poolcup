import type { SupabaseClient } from '@supabase/supabase-js'
import type { R32BracketMatchesByNumber } from '@/src/lib/winner-only-r32-bracket'

type KnockoutRoundCode = 'r32' | 'r16'

/** Load knockout-round matches + member advance_pick (mirrors winner pool R32 path). */
export async function fetchWinnerKnockoutRoundMatches(
  supabase: SupabaseClient,
  round: KnockoutRoundCode,
  poolId: string,
  memberId: string,
): Promise<{ matchesByNumber: R32BracketMatchesByNumber; error: string | null }> {
  const { data: matchRows, error: matchesError } = await supabase
    .from('matches')
    .select('id, match_number, team1_name, team2_name, locked_at')
    .eq('round', round)
    .order('match_number', { ascending: true })

  if (matchesError) {
    return {
      matchesByNumber: new Map(),
      error: `Could not load ${round} matches.`,
    }
  }

  const rows = matchRows ?? []
  const matchIds = rows.map((row) => row.id)

  const pickByMatchId = new Map<string, 1 | 2>()
  if (matchIds.length > 0) {
    const { data: predictionRows, error: predictionsError } = await supabase
      .from('predictions')
      .select('match_id, advance_pick')
      .eq('pool_id', poolId)
      .eq('member_id', memberId)
      .in('match_id', matchIds)

    if (predictionsError) {
      return {
        matchesByNumber: new Map(),
        error: 'Could not load your knockout picks.',
      }
    }

    for (const row of predictionRows ?? []) {
      if (row.advance_pick === 1 || row.advance_pick === 2) {
        pickByMatchId.set(row.match_id, row.advance_pick)
      }
    }
  }

  const matchesByNumber: R32BracketMatchesByNumber = new Map()
  for (const row of rows) {
    const pick = pickByMatchId.get(row.id) ?? null
    matchesByNumber.set(row.match_number, {
      matchId: row.id,
      matchNumber: row.match_number,
      team1Name: row.team1_name,
      team2Name: row.team2_name,
      lockedAt: row.locked_at,
      myPick: pick,
      savedPick: pick,
    })
  }

  return { matchesByNumber, error: null }
}
