import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  LeaderboardCacheRow,
  PoolLeaderboardMember,
} from '@/src/lib/pool-leaderboard'

/**
 * Service-role lookup of banned user ids among a candidate set.
 * Server-only (API routes / exports). Prefer
 * {@link fetchBannedUserIdsAmongViaRpc} on client paths.
 * Data rows stay in the DB; this is display/participation gating only.
 */
export async function fetchBannedUserIdsAmong(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return new Set()

  const banned = new Set<string>()
  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await admin
      .from('users')
      .select('id')
      .in('id', chunk)
      .eq('banned', true)

    if (error) {
      console.error('fetchBannedUserIdsAmong failed:', error.message)
      continue
    }
    for (const row of data ?? []) {
      if (row?.id) banned.add(String(row.id))
    }
  }
  return banned
}

/**
 * Client-safe banned lookup via SECURITY DEFINER RPC
 * `get_banned_user_ids_among` (user session; no service role).
 */
export async function fetchBannedUserIdsAmongViaRpc(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return new Set()

  const banned = new Set<string>()
  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase.rpc('get_banned_user_ids_among', {
      p_user_ids: chunk,
    })

    if (error) {
      console.error('fetchBannedUserIdsAmongViaRpc failed:', error.message)
      continue
    }

    const ids = Array.isArray(data) ? data : []
    for (const id of ids) {
      if (id != null) banned.add(String(id))
    }
  }
  return banned
}

/** Client helper: banned members for a pool (membership-gated API). */
export async function fetchPoolBannedUserIdsClient(
  poolId: string,
): Promise<Set<string>> {
  try {
    const res = await fetch(
      `/api/pools/${encodeURIComponent(poolId)}/banned-user-ids`,
      { cache: 'no-store' },
    )
    if (!res.ok) return new Set()
    const json = (await res.json()) as { bannedUserIds?: string[] }
    return new Set(json.bannedUserIds ?? [])
  } catch {
    return new Set()
  }
}

/** Drop banned members and densify cache ranks for display. */
export function excludeBannedFromPoolLeaderboardInputs(
  poolMembers: PoolLeaderboardMember[],
  cacheRows: LeaderboardCacheRow[] | null,
  bannedUserIds: ReadonlySet<string>,
): {
  poolMembers: PoolLeaderboardMember[]
  cacheRows: LeaderboardCacheRow[] | null
} {
  if (bannedUserIds.size === 0) {
    return { poolMembers, cacheRows }
  }

  const activeMembers = poolMembers.filter(
    (member) => !member.user_id || !bannedUserIds.has(member.user_id),
  )
  const activeMemberIds = new Set(activeMembers.map((member) => member.id))

  if (!cacheRows) {
    return { poolMembers: activeMembers, cacheRows: null }
  }

  const densified = cacheRows
    .filter((row) => activeMemberIds.has(row.member_id))
    .slice()
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      return a.member_id.localeCompare(b.member_id)
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      // prev_rank is not meaningful after exclusion
      prev_rank: null as number | null,
    }))

  return { poolMembers: activeMembers, cacheRows: densified }
}
