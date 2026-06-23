import type { SupabaseClient } from '@supabase/supabase-js'

export type UserMatchPrediction = {
  predTeam1: number
  predTeam2: number
  advancePick: number | null
  team1Name: string
  team2Name: string
}

export function parseUserMatchPrediction(data: unknown): UserMatchPrediction | null {
  if (!data || typeof data !== 'object') return null

  const row = data as Record<string, unknown>
  const predTeam1 = row.pred_team1 ?? row.predTeam1
  const predTeam2 = row.pred_team2 ?? row.predTeam2

  if (typeof predTeam1 !== 'number' || typeof predTeam2 !== 'number') {
    return null
  }

  const team1Name = row.team1_name ?? row.team1Name
  const team2Name = row.team2_name ?? row.team2Name

  if (typeof team1Name !== 'string' || typeof team2Name !== 'string') {
    return null
  }

  const advanceRaw = row.advance_pick ?? row.advancePick

  return {
    predTeam1,
    predTeam2,
    advancePick: typeof advanceRaw === 'number' ? advanceRaw : null,
    team1Name,
    team2Name,
  }
}

export async function fetchUserMatchPrediction(
  supabase: SupabaseClient,
  matchId: string,
): Promise<UserMatchPrediction | null> {
  const { data, error } = await supabase.rpc('get_user_match_prediction', {
    p_match_id: matchId,
  })

  if (error) {
    console.error('Failed to load user match prediction:', error.message)
    return null
  }

  return parseUserMatchPrediction(data)
}
