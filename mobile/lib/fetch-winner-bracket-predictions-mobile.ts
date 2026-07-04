import type { SupabaseClient } from '@supabase/supabase-js'
import {
  emptyGroupRankings,
  parseStandingsJson,
  parseThirdPlaceRankingsJson,
  syncThirdPlaceRankings,
  WORLD_CUP_GROUP_LETTERS,
  type GroupRankings,
  type GroupStageMatch,
  type WorldCupGroupLetter,
} from '@/src/lib/world-cup-groups'

export type WinnerBracketPredictionsMobileData = {
  groupRankings: GroupRankings
  thirdPlaceRankings: string[]
  matches: GroupStageMatch[]
  error: string | null
}

type GroupPredictionRow = {
  group_name: string
  standings: unknown
}

/** READ-ONLY: loads group_predictions, third_place_rankings, and group-stage matches. */
export async function fetchWinnerBracketPredictionsMobile(
  supabase: SupabaseClient,
  poolId: string,
  memberId: string,
  userId: string,
): Promise<WinnerBracketPredictionsMobileData> {
  const [groupResult, thirdPlaceResult, matchesResult] = await Promise.all([
    supabase
      .from('group_predictions')
      .select('group_name, standings')
      .eq('pool_id', poolId)
      .eq('member_id', memberId),
    supabase
      .from('third_place_rankings')
      .select('rankings')
      .eq('pool_id', poolId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('matches')
      .select('round, group_name, team1_name, team2_name, kickoff_at, locked_at')
      .eq('round', 'group')
      .order('kickoff_at', { ascending: true }),
  ])

  if (matchesResult.error) {
    return {
      groupRankings: emptyGroupRankings(),
      thirdPlaceRankings: [],
      matches: [],
      error: 'Could not load matches.',
    }
  }

  if (groupResult.error) {
    return {
      groupRankings: emptyGroupRankings(),
      thirdPlaceRankings: [],
      matches: (matchesResult.data ?? []) as GroupStageMatch[],
      error: 'Could not load your group rankings.',
    }
  }

  const initial = emptyGroupRankings()
  for (const row of (groupResult.data ?? []) as GroupPredictionRow[]) {
    const letter = row.group_name.toUpperCase()
    if (
      WORLD_CUP_GROUP_LETTERS.includes(
        letter as (typeof WORLD_CUP_GROUP_LETTERS)[number],
      )
    ) {
      initial[letter] = parseStandingsJson(row.standings)
    }
  }

  const loadedThirdPlace = parseThirdPlaceRankingsJson(
    thirdPlaceResult.data?.rankings,
  )
  const syncedThirdPlace = syncThirdPlaceRankings(loadedThirdPlace, initial)

  if (thirdPlaceResult.error) {
    console.error(
      'Failed to load third place rankings:',
      thirdPlaceResult.error.message,
    )
  }

  return {
    groupRankings: initial,
    thirdPlaceRankings: syncedThirdPlace,
    matches: (matchesResult.data ?? []) as GroupStageMatch[],
    error: null,
  }
}
