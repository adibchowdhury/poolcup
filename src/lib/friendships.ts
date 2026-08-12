import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchFriendsXpLeaderboard } from '@/src/lib/global-rank'

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
  | 'blocked'

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

/** You + accepted friends, ranked by ledger XP (not pool points). */
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
  username: string | null
  avatar: string | null
  custom_avatar_url: string | null
  friendship_status: Exclude<FriendshipStatus, 'self'>
}

/** Friend social activity types (legacy get_friend_activity + new feed). */
export type FriendActivityType = 'badge' | 'pool_join' | 'prediction_result'

export type FriendActivityRow = {
  activity_type: FriendActivityType
  actor_id: string
  actor_name: string | null
  actor_username: string | null
  actor_avatar: string | null
  actor_custom_avatar_url: string | null
  occurred_at: string
  /** Badge name, pool name, or prediction headline. */
  title: string | null
  /** Optional secondary copy (prediction_result detail, etc.). */
  detail: string | null
  /** achievement_id (badge), pool_id (pool_join), or prediction/match ref. */
  ref_id: string | null
  pool_avatar: string | null
}

export type FriendSuggestionReason =
  | 'shared_pools'
  | 'shared_sports'
  | 'shared_both'
  | string

export type FriendSuggestionRow = {
  user_id: string
  display_name: string | null
  username: string | null
  avatar: string | null
  custom_avatar_url: string | null
  shared_pools: number
  shared_sports: number
  reason: FriendSuggestionReason | null
}

export type MuteUserResult = 'muted' | 'unmuted' | 'invalid' | 'self' | 'ok'
export type BlockUserResult = 'blocked' | 'unblocked' | 'invalid' | 'self' | 'ok'

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
    username: asString(row.username),
    avatar: asString(row.avatar),
    custom_avatar_url: asString(row.custom_avatar_url),
    friendship_status: status,
  }
}

function coerceFriendActivityRow(raw: unknown): FriendActivityRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const activityType = asString(row.activity_type)
  if (
    activityType !== 'badge' &&
    activityType !== 'pool_join' &&
    activityType !== 'prediction_result'
  ) {
    return null
  }
  const actorId = asString(row.actor_id)
  if (!actorId) return null
  const occurredAt = asString(row.occurred_at)
  if (!occurredAt) return null
  return {
    activity_type: activityType,
    actor_id: actorId,
    actor_name: asString(row.actor_name),
    actor_username: asString(row.actor_username),
    actor_avatar: asString(row.actor_avatar),
    actor_custom_avatar_url: asString(row.actor_custom_avatar_url),
    occurred_at: occurredAt,
    title: asString(row.title),
    detail: asString(row.detail),
    ref_id: asString(row.ref_id),
    pool_avatar: asString(row.pool_avatar),
  }
}

function coerceFriendSuggestionRow(raw: unknown): FriendSuggestionRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const userId = asString(row.user_id)
  if (!userId) return null
  return {
    user_id: userId,
    display_name: asString(row.display_name),
    username: asString(row.username),
    avatar: asString(row.avatar),
    custom_avatar_url: asString(row.custom_avatar_url),
    shared_pools: Math.max(0, asNumber(row.shared_pools) ?? 0),
    shared_sports: Math.max(0, asNumber(row.shared_sports) ?? 0),
    reason: asString(row.reason),
  }
}

/** Human-readable suggestion reason for UI. */
export function friendSuggestionReasonLabel(
  row: Pick<FriendSuggestionRow, 'reason' | 'shared_pools' | 'shared_sports'>,
): string {
  const raw = row.reason?.trim() ?? ''
  if (raw) {
    const lower = raw.toLowerCase()
    if (
      (lower.includes('pool') && lower.includes('sport')) ||
      lower.includes('shared_both') ||
      lower === 'shared_pools_and_sports'
    ) {
      return 'Shared pools & sports'
    }
    if (lower.includes('pool') || lower === 'shared_pools') {
      return 'In pools with you'
    }
    if (lower.includes('sport') || lower === 'shared_sports') {
      return 'Likes the same sports'
    }
    return raw
  }
  if (row.shared_pools > 0 && row.shared_sports > 0) {
    return 'Shared pools & sports'
  }
  if (row.shared_pools > 0) return 'In pools with you'
  if (row.shared_sports > 0) return 'Likes the same sports'
  return 'Suggested for you'
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
    const msg = error.message.toLowerCase()
    if (msg.includes('block')) {
      return { ok: true, result: 'blocked' }
    }
    return { ok: false, error: error.message }
  }
  const result = asString(data)
  if (
    result === 'pending' ||
    result === 'accepted' ||
    result === 'self' ||
    result === 'no_user' ||
    result === 'blocked'
  ) {
    if (result === 'accepted' && typeof window !== 'undefined') {
      void import('@/src/lib/xp-client').then(({ awardClientXp }) => {
        void awardClientXp({
          sourceType: 'friend_added',
          otherUserId: targetUserId,
        })
      })
    }
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
    if (result === 'accepted' && typeof window !== 'undefined') {
      void import('@/src/lib/xp-client').then(({ awardClientXp }) => {
        void awardClientXp({
          sourceType: 'friend_added',
          otherUserId: requesterUserId,
        })
      })
    }
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
): Promise<{ friends: FriendRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_my_friends')
  if (error) {
    console.error('get_my_friends failed:', error.message)
    return { friends: [], error: error.message }
  }
  const rows = Array.isArray(data) ? data : []
  return {
    friends: rows
      .map(coerceFriendRow)
      .filter((row): row is FriendRow => row != null),
    error: null,
  }
}

export async function getIncomingFriendRequests(
  supabase: SupabaseClient,
): Promise<{ requests: IncomingFriendRequestRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_incoming_friend_requests')
  if (error) {
    console.error('get_incoming_friend_requests failed:', error.message)
    return { requests: [], error: error.message }
  }
  const rows = Array.isArray(data) ? data : []
  return {
    requests: rows
      .map(coerceIncomingRow)
      .filter((row): row is IncomingFriendRequestRow => row != null),
    error: null,
  }
}

/**
 * Current user + accepted friends, ranked by live badge XP.
 * Distinct from in-pool points leaderboards.
 */
export async function getFriendsLeaderboard(
  supabase: SupabaseClient,
): Promise<FriendsLeaderboardRow[]> {
  const { rows, error } = await fetchFriendsXpLeaderboard(supabase)
  if (error) {
    return []
  }
  return rows.map((row) => ({
    user_id: row.user_id,
    display_name: row.display_name,
    avatar: row.avatar,
    custom_avatar_url: row.custom_avatar_url,
    total_xp: row.total_xp,
    rank: row.global_rank,
    is_me: row.is_me,
  }))
}

/**
 * Find users by username or display name. Requires >= 2 chars; excludes current user.
 * Returns only public fields + friendship_status — never email.
 */
export async function searchUsers(
  supabase: SupabaseClient,
  query: string,
  limit = 20,
): Promise<{ users: UserSearchRow[]; error: string | null }> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return { users: [], error: null }

  const { data, error } = await supabase.rpc('search_users', {
    p_query: trimmed,
    p_limit: Math.max(1, Math.min(limit, 50)),
  })

  if (error) {
    console.error('search_users failed:', error.message)
    return { users: [], error: error.message }
  }

  const rows = Array.isArray(data) ? data : []
  return {
    users: rows
      .map(coerceUserSearchRow)
      .filter((row): row is UserSearchRow => row != null),
    error: null,
  }
}

/**
 * Legacy: accepted friends' badge earns + pool joins (no prediction_result / mute filter).
 * Prefer getFriendActivityFeed for new surfaces.
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

/**
 * Paginated friends activity (badge, pool_join, prediction_result).
 * Server excludes muted/blocked actors; prediction_result is post-lock only.
 */
export async function getFriendActivityFeed(
  supabase: SupabaseClient,
  limit = 20,
  offset = 0,
): Promise<{ rows: FriendActivityRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_friend_activity_feed', {
    p_limit: Math.max(1, Math.min(limit, 100)),
    p_offset: Math.max(0, offset),
  })

  if (error) {
    console.error('get_friend_activity_feed failed:', error.message)
    return { rows: [], error: error.message }
  }

  const rows = Array.isArray(data) ? data : []
  return {
    rows: rows
      .map(coerceFriendActivityRow)
      .filter((row): row is FriendActivityRow => row != null),
    error: null,
  }
}

export async function getFriendSuggestions(
  supabase: SupabaseClient,
  limit = 12,
): Promise<{ suggestions: FriendSuggestionRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_friend_suggestions', {
    p_limit: Math.max(1, Math.min(limit, 50)),
  })

  if (error) {
    console.error('get_friend_suggestions failed:', error.message)
    return { suggestions: [], error: error.message }
  }

  const rows = Array.isArray(data) ? data : []
  return {
    suggestions: rows
      .map(coerceFriendSuggestionRow)
      .filter((row): row is FriendSuggestionRow => row != null),
    error: null,
  }
}

export async function getMutualFriendsCount(
  supabase: SupabaseClient,
  otherUserId: string,
): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase.rpc('get_mutual_friends_count', {
    p_other: otherUserId,
  })
  if (error) {
    console.error('get_mutual_friends_count failed:', error.message)
    return { count: 0, error: error.message }
  }
  return { count: Math.max(0, asNumber(data) ?? 0), error: null }
}

export async function muteUser(
  supabase: SupabaseClient,
  targetUserId: string,
  mute: boolean,
): Promise<{ ok: true; result: MuteUserResult } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('mute_user', {
    p_target: targetUserId,
    p_mute: mute,
  })
  if (error) {
    console.error('mute_user failed:', error.message)
    return { ok: false, error: error.message }
  }
  const result = asString(data)
  if (
    result === 'muted' ||
    result === 'unmuted' ||
    result === 'ok' ||
    result === 'invalid' ||
    result === 'self'
  ) {
    if (result === 'invalid' || result === 'self') {
      return { ok: false, error: result }
    }
    return { ok: true, result }
  }
  // Some deployments return void/null on success.
  if (data == null || data === true) {
    return { ok: true, result: mute ? 'muted' : 'unmuted' }
  }
  return { ok: false, error: 'Unexpected response' }
}

export async function blockUser(
  supabase: SupabaseClient,
  targetUserId: string,
  block: boolean,
): Promise<{ ok: true; result: BlockUserResult } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('block_user', {
    p_target: targetUserId,
    p_block: block,
  })
  if (error) {
    console.error('block_user failed:', error.message)
    return { ok: false, error: error.message }
  }
  const result = asString(data)
  if (
    result === 'blocked' ||
    result === 'unblocked' ||
    result === 'ok' ||
    result === 'invalid' ||
    result === 'self'
  ) {
    if (result === 'invalid' || result === 'self') {
      return { ok: false, error: result }
    }
    return { ok: true, result }
  }
  if (data == null || data === true) {
    return { ok: true, result: block ? 'blocked' : 'unblocked' }
  }
  return { ok: false, error: 'Unexpected response' }
}

/** Whether the current user has muted `otherUserId` (RLS: own rows). */
export async function isUserMuted(
  supabase: SupabaseClient,
  otherUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_mutes')
    .select('id')
    .eq('muted_user_id', otherUserId)
    .maybeSingle()
  if (error) {
    console.error('isUserMuted failed:', error.message)
    return false
  }
  return Boolean(data)
}

/** Whether the current user has blocked `otherUserId` (RLS: own rows). */
export async function isUserBlocked(
  supabase: SupabaseClient,
  otherUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocked_user_id', otherUserId)
    .maybeSingle()
  if (error) {
    console.error('isUserBlocked failed:', error.message)
    return false
  }
  return Boolean(data)
}

/** Muted user ids for the current user (for friend-list badges). */
export async function listMutedUserIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_mutes')
    .select('muted_user_id')
  if (error) {
    console.error('listMutedUserIds failed:', error.message)
    return new Set()
  }
  const ids = new Set<string>()
  for (const row of data ?? []) {
    const id = asString(
      (row as { muted_user_id?: unknown }).muted_user_id,
    )
    if (id) ids.add(id)
  }
  return ids
}

/** Map send_friend_request result → UI friendship status. */
export function statusAfterSend(
  result: SendFriendRequestResult,
): FriendshipStatus | null {
  if (result === 'pending') return 'request_sent'
  if (result === 'accepted') return 'friends'
  return null
}
