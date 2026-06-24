import type { SupabaseClient } from '@supabase/supabase-js'

export type SquadLeaderboardRow = {
  rank: number
  pool_id: string
  name: string
  avatar: string | null
  scoring_style: string
  member_count: number
  total_points: number
  avg_points: number
  is_mine: boolean
}

export type SquadLeaderboardDisplay = {
  /** Top preview rows, or the full list when expanded. */
  rows: SquadLeaderboardRow[]
  /** User squads below the preview that are not already shown in `rows`. */
  pinnedMineRows: SquadLeaderboardRow[]
}

export async function fetchSquadLeaderboard(
  supabase: SupabaseClient,
): Promise<SquadLeaderboardRow[] | null> {
  const { data, error } = await supabase.rpc('get_squad_leaderboard')

  if (error) {
    console.error('Failed to fetch squad leaderboard:', error.message)
    return null
  }

  return Array.isArray(data) ? (data as SquadLeaderboardRow[]) : []
}

export const SQUAD_LEADERBOARD_PREVIEW_COUNT = 8

export function buildSquadLeaderboardDisplay(
  rows: SquadLeaderboardRow[],
  expanded: boolean,
): SquadLeaderboardDisplay {
  if (expanded || rows.length <= SQUAD_LEADERBOARD_PREVIEW_COUNT) {
    return { rows, pinnedMineRows: [] }
  }

  const preview = rows.slice(0, SQUAD_LEADERBOARD_PREVIEW_COUNT)
  const previewPoolIds = new Set(preview.map((row) => row.pool_id))
  const pinnedMineRows = rows.filter(
    (row) => row.is_mine && !previewPoolIds.has(row.pool_id),
  )

  return { rows: preview, pinnedMineRows }
}
