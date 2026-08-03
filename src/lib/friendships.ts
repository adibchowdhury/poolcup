import type { SupabaseClient } from '@supabase/supabase-js'

export type FriendshipStatus =
  | 'none'
  | 'friends'
  | 'request_sent'
  | 'request_received'
  | 'self'

export type SendFriendRequestResult =
  | 'pending'
  | 'accepted'
  | 'self'
  | 'no_user'

export type AcceptFriendRequestResult = 'accepted' | 'no_request'

export type RemoveFriendResult = 'removed' | 'not_found'

export type FriendRow = {
  user_id: string
  display_name: string | null
  avatar: string | null
  custom_avatar_url: string | null
  friends_since: string
}

export type IncomingFriendRequestRow = {
  user_id: string
  display_name: string | null
  avatar: string | null
  custom_avatar_url: string | null
  requested_at: string
}

/** You + accepted friends, ranked by live badge XP (not pool points). */
export type FriendsLeaderboardRow = {
  user_id: string
  display_name: string | null
  avatar: string | null
  custom_avatar_url: string | null
  total_xp: number
  rank: number
  is_me: boolean
}

/** Public user search hit (never includes email). */
export type UserSearchRow = {
  user_id: string
  display_name: string | null
  avatar: string | null
  custom_avatar_url: string | null
  friendship_status: Exclude<FriendshipStatus, 'self'>
}

/** Friend social activity from get_friend_activity (badge earns + pool joins). */
export type FriendActivityType = 'badge' | 'pool_join'

export type FriendActivityRow = {
  activity_type: FriendActivityType
  actor_id: string
  actor_name: string | null
  actor_avatar: string | null
  actor_custom_avatar_url: string | null
  occurred_at: string
  /** Badge name or pool name. */
  title: string | null
  /** achievement_id (badge) or pool_id (pool_join). */
  ref_id: string | null
  pool_avatar: string | null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function coerceFriendshipStatus(raw: unknown): FriendshipStatus {
  const value = asString(raw)
  if (
    value === 'none' ||
    value === 'friends' ||
    value === 'request_sent' ||
    value === 'request_received' ||
    value === 'self'
  ) {
    return value
  }
  return 'none'
}

function coerceFriendRow(raw: unknown): FriendRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const userId = asString(row.user_id)
  if (!userId) return null
  return {
    user_id: userId,
    display_name: asString(row.display_name),
    avatar: asString(row.avatar),
    custom_avatar_url: asString(row.custom_avatar_url),
    friends_since: asString(row.friends_since) ?? '',
  }
}

function coerceIncomingRow(raw: unknown): IncomingFriendRequestRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const userId = asString(row.user_id)
  if (!userId) return null
  return {
    user_id: userId,
    display_name: asString(row.display_name),
    avatar: asString(row.avatar),
    custom_avatar_url: asString(row.custom_avatar_url),
    requested_at: asString(row.requested_at) ?? '',
  }
}

function coerceFriendsLeaderboardRow(raw: unknown): FriendsLeaderboardRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const userId = asString(row.user_id)
  if (!userId) return null
  const rank = asNumber(row.rank)
  if (rank == null || rank <= 0) return null
  return {
    user_id: userId,
    display_name: asString(row.display_name),
    avatar: asString(row.avatar),
    custom_avatar_url: asString(row.custom_avatar_url),
    total_xp: Math.max(0, asNumber(row.total_xp) ?? 0),
    rank: Math.floor(rank),
    is_me: Boolean(row.is_me),
  }
}

function coerceUserSearchRow(raw: unknown): UserSearchRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const userId = asString(row.user_id)
  if (!userId) return null
  const status = asString(row.friendship_status)
  if (
    status !== 'none' &&
    status !== 'friends' &&
    status !== 'request_sent' &&
    status !== 'request_received'
  ) {
    return null
  }
  return {
    user_id: userId,
    display_name: asString(row.display_name),
    avatar: asString(row.avatar),
    custom_avatar_url: asString(row.custom_avatar_url),
    friendship_status: status,
  }
}

function coerceFriendActivityRow(raw: unknown): FriendActivityRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const activityType = asString(row.activity_type)
  if (activityType !== 'badge' && activityType !== 'pool_join') return null
  const actorId = asString(row.actor_id)
  if (!actorId) return null
  const occurredAt = asString(row.occurred_at)
  if (!occurredAt) return null
  return {
    activity_type: activityType,
    actor_id: actorId,
    actor_name: asString(row.actor_name),
    actor_avatar: asString(row.actor_avatar),
    actor_custom_avatar_url: asString(row.actor_custom_avatar_url),
    occurred_at: occurredAt,
    title: asString(row.title),
    ref_id: asString(row.ref_id),
    pool_avatar: asString(row.pool_avatar),
  }
}

export async function getFriendshipStatus(
  supabase: SupabaseClient,
  otherUserId: string,
): Promise<FriendshipStatus> {
  const { data, error } = await supabase.rpc('get_friendship_status', {
    p_other: otherUserId,
  })
  if (error) {
    console.error('get_friendship_status failed:', error.message)
    return 'none'
  }
  return coerceFriendshipStatus(data)
}

export async function sendFriendRequest(
  supabase: SupabaseClient,
  targetUserId: string,
): Promise<{ ok: true; result: SendFriendRequestResult } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('send_friend_request', {
    p_target: targetUserId,
  })
  if (error) {
    console.error('send_friend_request failed:', error.message)
    return { ok: false, error: error.message }
  }
  const result = asString(data)
  if (
    result === 'pending' ||
    result === 'accepted' ||
    result === 'self' ||
    result === 'no_user'
  ) {
    return { ok: true, result }
  }
  return { ok: false, error: 'Unexpected response' }
}

export async function acceptFriendRequest(
  supabase: SupabaseClient,
  requesterUserId: string,
): Promise<{ ok: true; result: AcceptFriendRequestResult } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('accept_friend_request', {
    p_requester: requesterUserId,
  })
  if (error) {
    console.error('accept_friend_request failed:', error.message)
    return { ok: false, error: error.message }
  }
  const result = asString(data)
  if (result === 'accepted' || result === 'no_request') {
    return { ok: true, result }
  }
  return { ok: false, error: 'Unexpected response' }
}

export async function removeFriend(
  supabase: SupabaseClient,
  otherUserId: string,
): Promise<{ ok: true; result: RemoveFriendResult } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('remove_friend', {
    p_other: otherUserId,
  })
  if (error) {
    console.error('remove_friend failed:', error.message)
    return { ok: false, error: error.message }
  }
  const result = asString(data)
  if (result === 'removed' || result === 'not_found') {
    return { ok: true, result }
  }
  return { ok: false, error: 'Unexpected response' }
}

export async function getMyFriends(
  supabase: SupabaseClient,
): Promise<FriendRow[]> {
  const { data, error } = await supabase.rpc('get_my_friends')
  if (error) {
    console.error('get_my_friends failed:', error.message)
    return []
  }
  const rows = Array.isArray(data) ? data : []
  return rows
    .map(coerceFriendRow)
    .filter((row): row is FriendRow => row != null)
}

export async function getIncomingFriendRequests(
  supabase: SupabaseClient,
): Promise<IncomingFriendRequestRow[]> {
  const { data, error } = await supabase.rpc('get_incoming_friend_requests')
  if (error) {
    console.error('get_incoming_friend_requests failed:', error.message)
    return []
  }
  const rows = Array.isArray(data) ? data : []
  return rows
    .map(coerceIncomingRow)
    .filter((row): row is IncomingFriendRequestRow => row != null)
}

/**
 * Current user + accepted friends, ranked by live badge XP.
 * Distinct from in-pool points leaderboards.
 */
export async function getFriendsLeaderboard(
  supabase: SupabaseClient,
): Promise<FriendsLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_friends_leaderboard')
  if (error) {
    console.error('get_friends_leaderboard failed:', error.message)
    return []
  }
  const rows = Array.isArray(data) ? data : []
  return rows
    .map(coerceFriendsLeaderboardRow)
    .filter((row): row is FriendsLeaderboardRow => row != null)
    .sort((a, b) => a.rank - b.rank)
}

/**
 * Find users by display name. Requires >= 2 chars; excludes current user.
 * Returns only public fields + friendship_status — never email.
 */
export async function searchUsers(
  supabase: SupabaseClient,
  query: string,
  limit = 20,
): Promise<UserSearchRow[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const { data, error } = await supabase.rpc('search_users', {
    p_query: trimmed,
    p_limit: Math.max(1, Math.min(limit, 50)),
  })

  if (error) {
    console.error('search_users failed:', error.message)
    return []
  }

  const rows = Array.isArray(data) ? data : []
  return rows
    .map(coerceUserSearchRow)
    .filter((row): row is UserSearchRow => row != null)
}

/**
 * Accepted friends' recent activity (badge earns + pool joins), newest first.
 */
export async function getFriendActivity(
  supabase: SupabaseClient,
  limit = 30,
): Promise<FriendActivityRow[]> {
  const { data, error } = await supabase.rpc('get_friend_activity', {
    p_limit: Math.max(1, Math.min(limit, 100)),
  })

  if (error) {
    console.error('get_friend_activity failed:', error.message)
    return []
  }

  const rows = Array.isArray(data) ? data : []
  return rows
    .map(coerceFriendActivityRow)
    .filter((row): row is FriendActivityRow => row != null)
}

/** Map send_friend_request result → UI friendship status. */
export function statusAfterSend(
  result: SendFriendRequestResult,
): FriendshipStatus | null {
  if (result === 'pending') return 'request_sent'
  if (result === 'accepted') return 'friends'
  return null
}
