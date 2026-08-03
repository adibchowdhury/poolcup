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

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
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

/** Map send_friend_request result → UI friendship status. */
export function statusAfterSend(
  result: SendFriendRequestResult,
): FriendshipStatus | null {
  if (result === 'pending') return 'request_sent'
  if (result === 'accepted') return 'friends'
  return null
}
