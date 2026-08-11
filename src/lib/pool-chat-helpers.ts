export const ALLOWED_CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '🔥', '⚽'] as const

export type AllowedChatReaction = (typeof ALLOWED_CHAT_REACTIONS)[number]

export const MESSAGE_GROUP_GAP_MS = 5 * 60 * 1000

export type PoolChatMessageType = 'user' | 'system'

export type MatchMomentKind = 'full_time' | 'exact_score' | 'new_leader'

/** metadata jsonb on system messages from post_match_moments. */
export type PoolChatSystemMetadata = {
  kind?: MatchMomentKind | string
  team1?: string
  team2?: string
  score1?: number | string
  score2?: number | string
  team1_logo?: string | null
  team2_logo?: string | null
  players?: string[]
  player?: string
  match_id?: string
  [key: string]: unknown
}

export type PoolChatMessageClientStatus = 'sending' | 'failed'

export type PoolChatMessage = {
  id: string
  pool_id: string
  user_id: string | null
  content: string
  created_at: string
  message_type?: PoolChatMessageType | null
  metadata?: PoolChatSystemMetadata | null
  /** Client-only: optimistic send lifecycle (not stored in DB). */
  clientStatus?: PoolChatMessageClientStatus | null
}

export type MessageReactionRow = {
  message_id: string
  user_id: string
  emoji: string
}

export type AggregatedReaction = {
  emoji: string
  count: number
  reactedByMe: boolean
}

export type MessageGroup = {
  userId: string
  messages: PoolChatMessage[]
}

export type ChatListItem =
  | { type: 'day-divider'; label: string; key: string }
  | { type: 'unread-divider'; key: string }
  | { type: 'group'; group: MessageGroup; key: string }
  | { type: 'system'; message: PoolChatMessage; key: string }

export const POOL_CHAT_PAGE_SIZE = 50

export function isOptimisticChatMessageId(id: string): boolean {
  return id.startsWith('optimistic-')
}

const AVATAR_COLOR_CLASSES = [
  'bg-[#1a3d4a] text-[#7dd3fc]',
  'bg-[#2d3a5c] text-[#a5b4fc]',
  'bg-[#3d2a4a] text-[#d8b4fe]',
  'bg-[#3a3520] text-[#fde047]',
  'bg-[#1f3d2e] text-[#86efac]',
  'bg-[#4a2c2c] text-[#fca5a5]',
  'bg-[#2a3a4a] text-[#93c5fd]',
  'bg-[#3a2a35] text-[#f9a8d4]',
]

export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
}

export function avatarColorClassForUser(userId: string): string {
  let hash = 0
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash + userId.charCodeAt(index)) % AVATAR_COLOR_CLASSES.length
  }
  return AVATAR_COLOR_CLASSES[hash]!
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function getDayDividerLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (isSameCalendarDay(date, today)) return 'Today'
  if (isSameCalendarDay(date, yesterday)) return 'Yesterday'

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/** Absolute local time for hover / title (user locale). */
export function formatChatAbsoluteTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatChatTimestamp(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return 'just now'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`
  }

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) {
    return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`
  }

  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) {
    return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`
  }

  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) {
    return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`
  }

  const diffYear = Math.floor(diffMonth / 12)
  return diffYear === 1 ? '1 year ago' : `${diffYear} years ago`
}

/** True when pool_messages INSERT was blocked by send rate-limit RLS. */
export function isPoolChatRateLimitError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  if (msg.includes('too fast') || msg.includes('rate limit') || msg.includes('too many')) {
    return true
  }
  // RLS policy rejection (Postgres insufficient_privilege / generic RLS).
  if (error.code === '42501' && msg.includes('row-level security')) return true
  if (msg.includes('row-level security') && msg.includes('pool_messages')) {
    return true
  }
  return false
}

export function isSystemChatMessage(message: PoolChatMessage): boolean {
  if (message.message_type === 'system') return true
  if (message.message_type === 'user') return false
  return message.user_id == null
}

export function groupMessages(messages: PoolChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []

  for (const message of messages) {
    if (isSystemChatMessage(message) || message.user_id == null) {
      continue
    }

    const previous = groups[groups.length - 1]
    if (previous && previous.userId === message.user_id) {
      const lastMessage = previous.messages[previous.messages.length - 1]!
      const gap =
        new Date(message.created_at).getTime() -
        new Date(lastMessage.created_at).getTime()
      if (gap <= MESSAGE_GROUP_GAP_MS) {
        previous.messages.push(message)
        continue
      }
    }

    groups.push({ userId: message.user_id, messages: [message] })
  }

  return groups
}

export function buildChatListItems(
  messages: PoolChatMessage[],
  options?: { firstUnreadMessageId?: string | null },
): ChatListItem[] {
  const firstUnreadMessageId = options?.firstUnreadMessageId ?? null
  const items: ChatListItem[] = []
  let lastDayLabel: string | null = null
  let pendingUserMessages: PoolChatMessage[] = []
  let unreadDividerInserted = false

  const pushUnreadIfNeeded = (messageId: string) => {
    if (!firstUnreadMessageId || unreadDividerInserted) return
    if (messageId !== firstUnreadMessageId) return
    items.push({ type: 'unread-divider', key: 'unread-divider' })
    unreadDividerInserted = true
  }

  const pushDayIfNeeded = (createdAt: string) => {
    const dayLabel = getDayDividerLabel(createdAt)
    if (dayLabel && dayLabel !== lastDayLabel) {
      items.push({
        type: 'day-divider',
        label: dayLabel,
        key: `day-${dayLabel}-${createdAt}`,
      })
      lastDayLabel = dayLabel
    }
  }

  const flushUserMessages = () => {
    if (pendingUserMessages.length === 0) return
    for (const group of groupMessages(pendingUserMessages)) {
      const firstMessage = group.messages[0]!
      pushDayIfNeeded(firstMessage.created_at)
      // Unread divider sits just before the first unread message in the group.
      const unreadIndex = firstUnreadMessageId
        ? group.messages.findIndex((m) => m.id === firstUnreadMessageId)
        : -1
      if (unreadIndex > 0) {
        const before = group.messages.slice(0, unreadIndex)
        const after = group.messages.slice(unreadIndex)
        items.push({
          type: 'group',
          group: { userId: group.userId, messages: before },
          key: `group-${before.map((message) => message.id).join('-')}`,
        })
        pushUnreadIfNeeded(firstUnreadMessageId!)
        items.push({
          type: 'group',
          group: { userId: group.userId, messages: after },
          key: `group-${after.map((message) => message.id).join('-')}`,
        })
      } else {
        pushUnreadIfNeeded(firstMessage.id)
        items.push({
          type: 'group',
          group,
          key: `group-${group.messages.map((message) => message.id).join('-')}`,
        })
      }
    }
    pendingUserMessages = []
  }

  for (const message of messages) {
    if (isSystemChatMessage(message)) {
      flushUserMessages()
      pushDayIfNeeded(message.created_at)
      pushUnreadIfNeeded(message.id)
      items.push({
        type: 'system',
        message,
        key: `system-${message.id}`,
      })
      continue
    }

    pendingUserMessages.push(message)
  }

  flushUserMessages()
  return items
}

/** First message strictly after lastReadAt (ISO), or null. */
export function findFirstUnreadMessageId(
  messages: PoolChatMessage[],
  lastReadAt: string | null,
  currentUserId: string,
): string | null {
  if (!lastReadAt) return null
  const readMs = Date.parse(lastReadAt)
  if (Number.isNaN(readMs)) return null

  for (const message of messages) {
    if (isOptimisticChatMessageId(message.id)) continue
    if (message.user_id === currentUserId) continue
    const createdMs = Date.parse(message.created_at)
    if (Number.isNaN(createdMs)) continue
    if (createdMs > readMs) return message.id
  }
  return null
}

export function aggregateReactions(
  rows: MessageReactionRow[],
  currentUserId: string,
): Map<string, AggregatedReaction[]> {
  const byMessage = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>()

  for (const row of rows) {
    const emojiMap = byMessage.get(row.message_id) ?? new Map()
    const existing = emojiMap.get(row.emoji) ?? { count: 0, reactedByMe: false }
    emojiMap.set(row.emoji, {
      count: existing.count + 1,
      reactedByMe: existing.reactedByMe || row.user_id === currentUserId,
    })
    byMessage.set(row.message_id, emojiMap)
  }

  const result = new Map<string, AggregatedReaction[]>()
  for (const [messageId, emojiMap] of byMessage) {
    const aggregated = [...emojiMap.entries()]
      .map(([emoji, stats]) => ({
        emoji,
        count: stats.count,
        reactedByMe: stats.reactedByMe,
      }))
      .sort((a, b) => a.emoji.localeCompare(b.emoji))
    result.set(messageId, aggregated)
  }

  return result
}

export function isDuplicateReactionError(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}

export function formatPlayerList(players: string[]): string {
  const cleaned = players.map((name) => name.trim()).filter(Boolean)
  if (cleaned.length === 0) return 'Someone'
  if (cleaned.length === 1) return cleaned[0]!
  if (cleaned.length === 2) return `${cleaned[0]} & ${cleaned[1]}`
  return `${cleaned.slice(0, -1).join(', ')} & ${cleaned[cleaned.length - 1]}`
}
