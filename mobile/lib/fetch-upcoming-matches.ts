import type { SupabaseClient } from '@supabase/supabase-js'

export type UpcomingMatch = {
  id: string
  kickoff_at: string
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  group_name: string | null
  round: string
}

const UPCOMING_MATCHES_QUERY_LIMIT = 100

/** Same query as components/dashboard/upcoming-games-tab.tsx */
export async function fetchUpcomingMatches(
  supabase: SupabaseClient,
): Promise<{ matches: UpcomingMatch[]; error: string | null }> {
  const { data, error: fetchError } = await supabase
    .from('matches')
    .select(
      'id, kickoff_at, team1_name, team2_name, team1_flag, team2_flag, group_name, round',
    )
    .gt('kickoff_at', new Date().toISOString())
    .eq('is_final', false)
    .order('kickoff_at', { ascending: true })
    .limit(UPCOMING_MATCHES_QUERY_LIMIT)

  if (fetchError) {
    return { matches: [], error: fetchError.message }
  }

  return { matches: (data ?? []) as UpcomingMatch[], error: null }
}
