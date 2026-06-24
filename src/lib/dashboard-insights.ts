import type { SupabaseClient } from '@supabase/supabase-js'

export type DashboardTodayMatch = {
  id: string
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  kickoff_at: string
  status_short: string | null
  elapsed_minute: number | null
  is_final: boolean
  is_locked: boolean
  round: string
  group_name: string | null
  predicted_pool_count: number
}

export type DashboardTodayMatchesResult = {
  user_score_pool_count: number
  matches: DashboardTodayMatch[]
}

export type DashboardActivityType =
  | 'rank_first'
  | 'rank_up'
  | 'exact_score'
  | 'points_gained'
  | 'submissions'

export type DashboardActivityItem = {
  type: DashboardActivityType
  actor: string | null
  pool_name: string | null
  invite_code: string | null
  value: number | null
  occurred_at: string
}

export function isDashboardMatchDue(
  match: DashboardTodayMatch,
  userScorePoolCount: number,
): boolean {
  return (
    !match.is_locked &&
    match.predicted_pool_count < userScorePoolCount
  )
}

export async function fetchDashboardTodayMatches(
  supabase: SupabaseClient,
): Promise<DashboardTodayMatchesResult | null> {
  const { data, error } = await supabase.rpc('get_dashboard_today_matches')

  if (error) {
    console.error('Failed to fetch dashboard today matches:', error.message)
    return null
  }

  if (!data || typeof data !== 'object') {
    return { user_score_pool_count: 0, matches: [] }
  }

  const payload = data as DashboardTodayMatchesResult
  return {
    user_score_pool_count: payload.user_score_pool_count ?? 0,
    matches: Array.isArray(payload.matches) ? payload.matches : [],
  }
}

export async function fetchDashboardActivity(
  supabase: SupabaseClient,
  limit = 10,
): Promise<DashboardActivityItem[] | null> {
  const { data, error } = await supabase.rpc('get_dashboard_activity', {
    p_limit: limit,
  })

  if (error) {
    console.error('Failed to fetch dashboard activity:', error.message)
    return null
  }

  return Array.isArray(data) ? (data as DashboardActivityItem[]) : []
}
