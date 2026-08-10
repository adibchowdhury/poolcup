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
  username: string | null
  avatar: string | null
  custom_avatar_url: string | null
  total_xp: number
  global_rank: number
}

export type GlobalXpLeaderboardPage = {
  rows: GlobalXpLeaderboardRow[]
  total_ranked: number
  error: string | null
}

export type FriendsXpLeaderboardResult = {
  rows: Array<GlobalXpLeaderboardRow & { is_me: boolean }>
  error: string | null
}

const PAGE_SIZE_DEFAULT = 50
const PAGE_SIZE_MAX = 100

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function coerceUserGlobalRank(raw: unknown): UserGlobalRank | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const totalXp = asNumber(row.total_xp) ?? 0
  const rankRaw = row.global_rank
  const globalRank =
    rankRaw == null || rankRaw === '' ? null : asNumber(rankRaw)
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
 * Banned users are excluded from rankings server-side.
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
  const userId = asString(row.user_id)
  if (!userId) return null
  const rank =
    asNumber(row.global_rank) ?? asNumber(row.rank)
  if (rank == null || rank <= 0) return null
  return {
    user_id: userId,
    display_name: asString(row.display_name),
    username: asString(row.username),
    avatar: asString(row.avatar),
    custom_avatar_url: asString(row.custom_avatar_url),
    total_xp: Math.max(0, asNumber(row.total_xp) ?? 0),
    global_rank: Math.floor(rank),
  }
}

/**
 * Paginated global XP leaderboard (excludes banned).
 * Each row may include total_ranked; we take it from the first row.
 */
export async function fetchGlobalXpLeaderboardPage(
  supabase: SupabaseClient,
  options?: { limit?: number; offset?: number },
): Promise<GlobalXpLeaderboardPage> {
  const limit = Math.max(
    1,
    Math.min(options?.limit ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX),
  )
  const offset = Math.max(0, options?.offset ?? 0)

  const { data, error } = await supabase.rpc('get_global_xp_leaderboard_page', {
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('get_global_xp_leaderboard_page failed:', error.message)
    return { rows: [], total_ranked: 0, error: error.message }
  }

  if (!Array.isArray(data)) {
    return { rows: [], total_ranked: 0, error: null }
  }

  const rows = data
    .map(coerceLeaderboardRow)
    .filter((row): row is GlobalXpLeaderboardRow => row != null)

  let totalRanked = 0
  for (const raw of data) {
    if (raw && typeof raw === 'object') {
      const n = asNumber((raw as Record<string, unknown>).total_ranked)
      if (n != null && n > 0) {
        totalRanked = Math.floor(n)
        break
      }
    }
  }

  return { rows, total_ranked: totalRanked, error: null }
}

/**
 * Current user + accepted friends, ranked by XP.
 * Prefers get_friends_xp_leaderboard; falls back to get_friends_leaderboard.
 */
export async function fetchFriendsXpLeaderboard(
  supabase: SupabaseClient,
): Promise<FriendsXpLeaderboardResult> {
  const primary = await supabase.rpc('get_friends_xp_leaderboard')
  let data = primary.data
  let error = primary.error

  if (error) {
    console.warn(
      'get_friends_xp_leaderboard failed, trying get_friends_leaderboard:',
      error.message,
    )
    const fallback = await supabase.rpc('get_friends_leaderboard')
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    console.error('friends XP leaderboard failed:', error.message)
    return { rows: [], error: error.message }
  }

  if (!Array.isArray(data)) {
    return { rows: [], error: null }
  }

  const rows = data
    .map((raw) => {
      const base = coerceLeaderboardRow(raw)
      if (!base || !raw || typeof raw !== 'object') return null
      return {
        ...base,
        is_me: Boolean((raw as Record<string, unknown>).is_me),
      }
    })
    .filter(
      (row): row is GlobalXpLeaderboardRow & { is_me: boolean } => row != null,
    )
    .sort((a, b) => a.global_rank - b.global_rank)

  return { rows, error: null }
}

/** @deprecated Prefer fetchGlobalXpLeaderboardPage — kept for older call sites. */
export async function fetchGlobalXpLeaderboard(
  supabase: SupabaseClient,
  limit = 100,
): Promise<GlobalXpLeaderboardRow[]> {
  const page = await fetchGlobalXpLeaderboardPage(supabase, {
    limit: Math.min(limit, PAGE_SIZE_MAX),
    offset: 0,
  })
  return page.rows
}

export const GLOBAL_XP_LEADERBOARD_PAGE_SIZE = PAGE_SIZE_DEFAULT
