import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Live XP-based global rank (earned badges' XP). Not pool points.
 * `global_rank` is null when the user has 0 XP / is unranked.
 */
export type UserGlobalRank = {
  total_xp: number
  global_rank: number | null
  total_ranked: number
}

export type GlobalXpLeaderboardRow = {
  user_id: string
  display_name: string | null
  avatar: string | null
  custom_avatar_url: string | null
  total_xp: number
  global_rank: number
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function coerceUserGlobalRank(raw: unknown): UserGlobalRank | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const totalXp = asNumber(row.total_xp) ?? 0
  const rankRaw = row.global_rank
  const globalRank =
    rankRaw == null || rankRaw === ''
      ? null
      : asNumber(rankRaw)
  const totalRanked = Math.max(0, asNumber(row.total_ranked) ?? 0)

  return {
    total_xp: Math.max(0, totalXp),
    global_rank:
      globalRank == null || globalRank <= 0 ? null : Math.floor(globalRank),
    total_ranked: totalRanked,
  }
}

/**
 * XP-based global rank for any user. Does not use users.points.
 */
export async function fetchUserGlobalRank(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserGlobalRank | null> {
  if (!userId) return null

  const { data, error } = await supabase.rpc('get_user_global_rank', {
    p_user_id: userId,
  })

  if (error) {
    console.error('get_user_global_rank failed:', error.message)
    return null
  }

  if (Array.isArray(data)) {
    return coerceUserGlobalRank(data[0] ?? null)
  }
  return coerceUserGlobalRank(data)
}

function coerceLeaderboardRow(raw: unknown): GlobalXpLeaderboardRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const userId = typeof row.user_id === 'string' ? row.user_id : null
  if (!userId) return null
  const rank = asNumber(row.global_rank)
  if (rank == null || rank <= 0) return null
  return {
    user_id: userId,
    display_name:
      typeof row.display_name === 'string' ? row.display_name : null,
    avatar: typeof row.avatar === 'string' ? row.avatar : null,
    custom_avatar_url:
      typeof row.custom_avatar_url === 'string'
        ? row.custom_avatar_url
        : null,
    total_xp: Math.max(0, asNumber(row.total_xp) ?? 0),
    global_rank: Math.floor(rank),
  }
}

/** Top N users by live badge XP. Optional for a future global leaderboard UI. */
export async function fetchGlobalXpLeaderboard(
  supabase: SupabaseClient,
  limit = 100,
): Promise<GlobalXpLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_global_xp_leaderboard', {
    p_limit: Math.max(1, Math.min(limit, 100)),
  })

  if (error) {
    console.error('get_global_xp_leaderboard failed:', error.message)
    return []
  }

  if (!Array.isArray(data)) return []
  return data
    .map(coerceLeaderboardRow)
    .filter((row): row is GlobalXpLeaderboardRow => row != null)
}
