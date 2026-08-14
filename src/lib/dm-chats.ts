import type { SupabaseClient } from '@supabase/supabase-js'
import { validateChatMessage } from '@/src/lib/ugc-limits'

export const DM_MARKED_READ_EVENT = 'dm-marked-read'

export type DmConversationRow = {
  conversation_id: string
  other_user_id: string
  other_display_name: string | null
  other_avatar: string | null
  other_custom_avatar_url: string | null
  last_message: string | null
  last_message_at: string | null
  last_sender_id: string | null
  unread_count: number
  still_friends: boolean
}

export type DmMessageRow = {
  id: string
  sender_id: string
  content: string
  created_at: string
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

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

export function isNotFriendsError(error: {
  message?: string
  details?: string
  hint?: string
} | null): boolean {
  if (!error) return false
  const text =
    `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return text.includes('not_friends')
}

export function getDmChatHref(conversationId: string): string {
  return `/chat/${conversationId}`
}

export function firstNameFromDisplayName(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? '').trim()
  if (!trimmed) return 'Friend'
  return trimmed.split(/\s+/)[0] ?? 'Friend'
}

export function formatDmLastMessagePreview(
  item: Pick<DmConversationRow, 'last_message' | 'last_sender_id'>,
  currentUserId: string,
): string {
  const content = item.last_message?.trim() ?? ''
  if (!content) return 'No messages yet'

  if (item.last_sender_id === currentUserId) {
    return `You: ${content}`
  }
  return content
}

function coerceDmConversation(raw: unknown): DmConversationRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const conversationId = asString(row.conversation_id)
  const otherUserId = asString(row.other_user_id)
  if (!conversationId || !otherUserId) return null

  return {
    conversation_id: conversationId,
    other_user_id: otherUserId,
    other_display_name: asString(row.other_display_name),
    other_avatar: asString(row.other_avatar),
    other_custom_avatar_url: asString(row.other_custom_avatar_url),
    last_message: asString(row.last_message),
    last_message_at: asString(row.last_message_at),
    last_sender_id: asString(row.last_sender_id),
    unread_count: Math.max(0, Math.floor(asNumber(row.unread_count) ?? 0)),
    still_friends: asBoolean(row.still_friends) ?? true,
  }
}

function coerceDmMessage(raw: unknown): DmMessageRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = asString(row.id)
  const senderId = asString(row.sender_id)
  const content = asString(row.content)
  const createdAt = asString(row.created_at)
  if (!id || !senderId || content == null || !createdAt) return null

  return {
    id,
    sender_id: senderId,
    content,
    created_at: createdAt,
  }
}

export async function getOrCreateDm(
  supabase: SupabaseClient,
  otherUserId: string,
): Promise<{ conversationId: string | null; notFriends: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc('get_or_create_dm', {
    p_other: otherUserId,
  })

  if (error) {
    if (isNotFriendsError(error)) {
      return { conversationId: null, notFriends: true, error: error.message }
    }
    console.error('get_or_create_dm failed:', error.message)
    return { conversationId: null, notFriends: false, error: error.message }
  }

  const conversationId =
    typeof data === 'string'
      ? data
      : data && typeof data === 'object' && 'conversation_id' in data
        ? asString((data as { conversation_id: unknown }).conversation_id)
        : asString(data)

  if (!conversationId) {
    return {
      conversationId: null,
      notFriends: false,
      error: 'Could not open conversation.',
    }
  }

  return { conversationId, notFriends: false, error: null }
}

export async function fetchMyDmConversations(
  supabase: SupabaseClient,
): Promise<DmConversationRow[]> {
  const { data, error } = await supabase.rpc('get_my_dm_conversations')

  if (error) {
    console.error('get_my_dm_conversations failed:', error.message)
    return []
  }

  const rows = Array.isArray(data) ? data : []
  return rows
    .map(coerceDmConversation)
    .filter((row): row is DmConversationRow => row != null)
}

export async function fetchDmMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 100,
): Promise<DmMessageRow[]> {
  const { data, error } = await supabase.rpc('get_dm_messages', {
    p_conversation_id: conversationId,
    p_limit: limit,
  })

  if (error) {
    console.error('get_dm_messages failed:', error.message)
    return []
  }

  const rows = Array.isArray(data) ? data : []
  return rows
    .map(coerceDmMessage)
    .filter((row): row is DmMessageRow => row != null)
}

export async function sendDm(
  supabase: SupabaseClient,
  conversationId: string,
  content: string,
): Promise<{ messageId: string | null; notFriends: boolean; error: string | null }> {
  const lengthError = validateChatMessage(content)
  if (lengthError) {
    return { messageId: null, notFriends: false, error: lengthError }
  }

  const { data, error } = await supabase.rpc('send_dm', {
    p_conversation_id: conversationId,
    p_content: content.trim(),
  })

  if (error) {
    if (isNotFriendsError(error)) {
      return { messageId: null, notFriends: true, error: error.message }
    }
    console.error('send_dm failed:', error.message)
    return { messageId: null, notFriends: false, error: error.message }
  }

  const messageId =
    typeof data === 'string'
      ? data
      : data && typeof data === 'object' && 'message_id' in data
        ? asString((data as { message_id: unknown }).message_id)
        : asString(data)

  return {
    messageId,
    notFriends: false,
    error: messageId ? null : 'Could not send message.',
  }
}

export async function markDmRead(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<boolean> {
  const { error } = await supabase.rpc('mark_dm_read', {
    p_conversation_id: conversationId,
  })

  if (error) {
    console.error('mark_dm_read failed:', error.message)
    return false
  }
  return true
}

export function emitDmMarkedRead(conversationId: string) {
  window.dispatchEvent(
    new CustomEvent(DM_MARKED_READ_EVENT, {
      detail: { conversationId },
    }),
  )
}

export async function fetchDmUnreadCount(supabase: SupabaseClient): Promise<number> {
  const conversations = await fetchMyDmConversations(supabase)
  return conversations.reduce((sum, row) => sum + row.unread_count, 0)
}
