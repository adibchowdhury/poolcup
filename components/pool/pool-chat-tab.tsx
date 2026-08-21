'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Flag, Loader2, MessageCircle, MoreHorizontal, RotateCcw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  emitPoolMarkedRead,
  fetchPoolLastReadAt,
  markPoolRead,
} from '@/src/lib/pool-unread-counts'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  ALLOWED_CHAT_REACTIONS,
  aggregateReactions,
  buildChatListItems,
  findFirstUnreadMessageId,
  formatChatAbsoluteTimestamp,
  formatChatTimestamp,
  isDuplicateReactionError,
  isOptimisticChatMessageId,
  POOL_CHAT_PAGE_SIZE,
  type AggregatedReaction,
  type MessageReactionRow,
  type PoolChatMessage,
} from '@/src/lib/pool-chat-helpers'
import { supabase } from '@/src/lib/supabase'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { ChatSystemMoment } from '@/components/pool/chat-system-moment'
import {
  AbuseReportDialog,
  type AbuseReportSubmitResult,
} from '@/components/abuse/abuse-report-dialog'

export type PoolChatMemberProfile = {
  displayName: string
  avatar: string | null
  customAvatarUrl: string | null
}

type PoolChatTabProps = {
  poolId: string
  currentUserId: string
  poolCreatorUserId: string
  memberProfilesByUserId: Map<string, PoolChatMemberProfile>
  hideHeading?: boolean
  embedded?: boolean
  fullBleedMobile?: boolean
  /**
   * Chat inbox right pane only: strip card chrome (border/radius/fixed height)
   * and fill the parent. Pool page Chat tab must not set this.
   */
  fullBleedDesktop?: boolean
}

const LONG_PRESS_MS = 450
const SCROLL_BOTTOM_THRESHOLD_PX = 48
const SCROLL_TOP_LOAD_THRESHOLD_PX = 72
const MESSAGE_SELECT =
  'id, pool_id, user_id, content, created_at, message_type, metadata'

const RATE_LIMIT_MESSAGE =
  "You're sending messages too fast — slow down a moment"

function resolveAuthor(
  userId: string,
  profiles: Map<string, PoolChatMemberProfile>,
): PoolChatMemberProfile {
  return (
    profiles.get(userId) ?? {
      displayName: 'Member',
      avatar: null,
      customAvatarUrl: null,
    }
  )
}

/** Avatar gutter width — keep stacked bubbles lined up when identity is hidden. */
const AVATAR_GUTTER_CLASS = 'w-8 shrink-0'
const REACTION_INDENT_OTHER = 'ml-10' // w-8 + gap-2

function ChatUserAvatar({
  userId,
  profile,
}: {
  userId: string
  profile: PoolChatMemberProfile
}) {
  return (
    <UserProfileLink
      userId={userId}
      ariaLabel={`${profile.displayName}'s profile`}
      className={cn('mb-0.5 shrink-0', FOCUS_VISIBLE_RING)}
    >
      <UserAvatarImage
        avatar={profile.avatar}
        customAvatarUrl={profile.customAvatarUrl}
        className="h-8 w-8"
      />
    </UserProfileLink>
  )
}

function ChatDayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border/70" />
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/70" />
    </div>
  )
}

function ChatUnreadDivider() {
  return (
    <div
      id="pool-chat-unread-anchor"
      className="flex items-center gap-3 py-3"
      role="separator"
      aria-label="New messages"
    >
      <div className="h-px flex-1 bg-primary/40" />
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-primary">
        New messages
      </span>
      <div className="h-px flex-1 bg-primary/40" />
    </div>
  )
}

function ReactionChip({
  reaction,
  onToggle,
}: {
  reaction: AggregatedReaction
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-8 items-center gap-1 rounded-full border px-2 text-xs transition-colors',
        FOCUS_VISIBLE_RING,
        reaction.reactedByMe
          ? 'border-primary/40 bg-primary/15 text-foreground'
          : 'border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted/70',
      )}
      aria-label={`${reaction.count} ${reaction.emoji} reactions`}
    >
      <span>{reaction.emoji}</span>
      <span className="font-mono tabular-nums">{reaction.count}</span>
    </button>
  )
}

function ChatMessageBubble({
  message,
  isYou,
  stacked,
  reactions,
  canDelete,
  canReport,
  reported,
  deleting,
  reporting,
  onDelete,
  onReport,
  onToggleReaction,
  onRetry,
  showAvatar = false,
  authorUserId,
  author,
}: {
  message: PoolChatMessage
  isYou: boolean
  stacked: boolean
  reactions: AggregatedReaction[]
  canDelete: boolean
  canReport: boolean
  reported: boolean
  deleting: boolean
  reporting: boolean
  onDelete: () => void
  onReport: () => void
  onToggleReaction: (emoji: string) => void
  onRetry?: () => void
  showAvatar?: boolean
  authorUserId?: string
  author?: PoolChatMemberProfile
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOptimistic = isOptimisticChatMessageId(message.id)
  const isFailed = message.clientStatus === 'failed'
  const isSending = message.clientStatus === 'sending'
  const showActions = !isOptimistic && (canDelete || canReport)
  const reserveOtherGutter = !isYou

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const startLongPress = useCallback(() => {
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      setMenuOpen(true)
    }, LONG_PRESS_MS)
  }, [clearLongPress])

  useEffect(() => clearLongPress, [clearLongPress])

  return (
    <div
      className={cn(
        'group/message relative flex w-full min-w-0 max-w-full flex-col',
        isYou ? 'items-end' : 'items-start',
        stacked ? 'mt-0.5' : 'mt-1',
      )}
      onTouchStart={showActions ? startLongPress : undefined}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <div
        className={cn(
          'flex w-full min-w-0 items-end gap-2',
          isYou && 'flex-row-reverse',
        )}
      >
        {reserveOtherGutter ? (
          showAvatar && authorUserId && author ? (
            <ChatUserAvatar userId={authorUserId} profile={author} />
          ) : (
            <div className={AVATAR_GUTTER_CLASS} aria-hidden />
          )
        ) : null}

        <div
          className={cn(
            'relative max-w-[min(100%,18rem)] sm:max-w-[min(100%,22rem)]',
            isYou ? 'items-end' : 'items-start',
          )}
        >
          <div className={cn('flex items-start gap-1', isYou && 'flex-row-reverse')}>
            <div
              className={cn(
                'rounded-2xl px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap',
                isYou
                  ? 'rounded-tr-md bg-primary/20 text-foreground ring-1 ring-primary/35'
                  : 'rounded-tl-md bg-muted/60 text-foreground',
                isFailed && 'opacity-80 ring-destructive/50',
                isSending && 'opacity-70',
              )}
            >
              {message.content}
            </div>

            {showActions ? (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted/60 hover:text-foreground',
                      FOCUS_VISIBLE_RING,
                      'opacity-100 sm:opacity-0 sm:group-hover/message:opacity-100',
                      menuOpen && 'opacity-100',
                    )}
                    aria-label="Message actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isYou ? 'end' : 'start'} className="w-52">
                  <div className="flex flex-wrap gap-1 border-b border-border/60 p-2">
                    {ALLOWED_CHAT_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={cn(
                          'inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-lg hover:bg-muted',
                          FOCUS_VISIBLE_RING,
                        )}
                        onClick={() => {
                          onToggleReaction(emoji)
                          setMenuOpen(false)
                        }}
                        aria-label={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {canReport ? (
                    <DropdownMenuItem
                      disabled={reporting || reported}
                      onSelect={(event) => {
                        event.preventDefault()
                        onReport()
                        setMenuOpen(false)
                      }}
                    >
                      <Flag className="h-4 w-4" />
                      {reported ? 'Reported' : 'Report'}
                    </DropdownMenuItem>
                  ) : null}
                  {canDelete ? (
                    <DropdownMenuItem
                      disabled={deleting}
                      className="text-destructive focus:text-destructive"
                      onSelect={(event) => {
                        event.preventDefault()
                        onDelete()
                        setMenuOpen(false)
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          {isFailed && onRetry ? (
            <div
              className={cn(
                'mt-1 flex items-center gap-2 text-[11px] text-destructive',
                isYou ? 'justify-end' : 'justify-start',
              )}
            >
              <span>Not sent</span>
              <button
                type="button"
                onClick={onRetry}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-primary hover:underline',
                  FOCUS_VISIBLE_RING,
                )}
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Retry
              </button>
            </div>
          ) : null}
          {isSending ? (
            <p
              className={cn(
                'mt-1 text-[10px] text-muted-foreground',
                isYou ? 'text-right' : 'text-left',
              )}
            >
              Sending…
            </p>
          ) : null}
        </div>
      </div>

      {reactions.length > 0 ? (
        <div
          className={cn(
            'mt-1 flex flex-wrap gap-1',
            reserveOtherGutter && REACTION_INDENT_OTHER,
            isYou ? 'justify-end' : 'justify-start',
          )}
        >
          {reactions.map((reaction) => (
            <ReactionChip
              key={`${message.id}-${reaction.emoji}`}
              reaction={reaction}
              onToggle={() => onToggleReaction(reaction.emoji)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ChatMessageGroup({
  userId,
  messages,
  currentUserId,
  memberProfilesByUserId,
  reactionsByMessageId,
  isPoolCreator,
  reportedIds,
  deletingId,
  reportingId,
  onDelete,
  onReport,
  onToggleReaction,
  onRetry,
}: {
  userId: string
  messages: PoolChatMessage[]
  currentUserId: string
  memberProfilesByUserId: Map<string, PoolChatMemberProfile>
  reactionsByMessageId: Map<string, AggregatedReaction[]>
  isPoolCreator: boolean
  reportedIds: Set<string>
  deletingId: string | null
  reportingId: string | null
  onDelete: (messageId: string) => void
  onReport: (message: PoolChatMessage) => void
  onToggleReaction: (messageId: string, emoji: string) => void
  onRetry: (messageId: string) => void
}) {
  const isYou = userId === currentUserId
  const author = resolveAuthor(userId, memberProfilesByUserId)
  const firstMessage = messages[0]!
  const absoluteTime = formatChatAbsoluteTimestamp(firstMessage.created_at)

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col',
        isYou ? 'items-end' : 'items-start',
      )}
    >
      <div
        className={cn(
          'mb-0.5 flex items-center gap-2',
          isYou ? 'flex-row-reverse' : 'flex-row',
          !isYou && REACTION_INDENT_OTHER,
        )}
      >
        {isYou ? (
          <span className="text-xs font-semibold text-primary">You</span>
        ) : (
          <UserProfileLink
            userId={userId}
            className={cn(
              'text-xs font-semibold text-foreground hover:underline',
              FOCUS_VISIBLE_RING,
            )}
          >
            {author.displayName}
          </UserProfileLink>
        )}
        <time
          className="text-[10px] text-muted-foreground"
          dateTime={firstMessage.created_at}
          title={absoluteTime}
          suppressHydrationWarning
        >
          {formatChatTimestamp(firstMessage.created_at)}
        </time>
      </div>

      {messages.map((message, index) => {
        const optimistic = isOptimisticChatMessageId(message.id)
        const canDelete = !optimistic && (isYou || isPoolCreator)
        const canReport = !optimistic && !isYou
        const isLast = index === messages.length - 1

        return (
          <ChatMessageBubble
            key={message.id}
            message={message}
            isYou={isYou}
            stacked={index > 0}
            reactions={
              optimistic ? [] : (reactionsByMessageId.get(message.id) ?? [])
            }
            canDelete={canDelete}
            canReport={canReport}
            reported={reportedIds.has(message.id)}
            deleting={deletingId === message.id}
            reporting={reportingId === message.id}
            onDelete={() => onDelete(message.id)}
            onReport={() => onReport(message)}
            onToggleReaction={(emoji) => onToggleReaction(message.id, emoji)}
            onRetry={
              message.clientStatus === 'failed'
                ? () => onRetry(message.id)
                : undefined
            }
            showAvatar={!isYou && isLast}
            authorUserId={userId}
            author={author}
          />
        )
      })}
    </div>
  )
}

export function PoolChatTab({
  poolId,
  currentUserId,
  poolCreatorUserId,
  memberProfilesByUserId,
  hideHeading = false,
  embedded = false,
  fullBleedMobile = false,
  fullBleedDesktop = false,
}: PoolChatTabProps) {
  const [messages, setMessages] = useState<PoolChatMessage[]>([])
  const [hiddenAuthorIds, setHiddenAuthorIds] = useState(() => new Set<string>())
  const [reportTarget, setReportTarget] = useState<PoolChatMessage | null>(null)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reactionRows, setReactionRows] = useState<MessageReactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set())
  const [reportNotice, setReportNotice] = useState<string | null>(null)
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false)
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(
    null,
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isAtBottomRef = useRef(true)
  const hasInitialScrolledRef = useRef(false)
  const isPrependingRef = useRef(false)
  const loadingOlderRef = useRef(false)
  const openedTrackedRef = useRef(false)
  const isPoolCreator = currentUserId === poolCreatorUserId
  const { setOpenChatPoolId } = useMobileChatChrome()

  useEffect(() => {
    setOpenChatPoolId(poolId)
    return () => {
      setOpenChatPoolId(null)
    }
  }, [poolId, setOpenChatPoolId])

  useEffect(() => {
    if (openedTrackedRef.current) return
    openedTrackedRef.current = true
    capturePostHog('chat_opened', { pool_id: poolId, surface: 'pool' })
  }, [poolId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/me/chat-visibility', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const json = (await res.json()) as {
          mutedUserIds?: string[]
          blockedPeerIds?: string[]
        }
        const next = new Set<string>()
        for (const id of json.mutedUserIds ?? []) next.add(id)
        for (const id of json.blockedPeerIds ?? []) next.add(id)
        if (!cancelled) {
          setHiddenAuthorIds(next)
          if ((json.mutedUserIds?.length ?? 0) > 0) {
            capturePostHog('user_muted_chat_applied', {
              muted_count: json.mutedUserIds!.length,
            })
          }
        }
      } catch (err) {
        console.error('Failed to load chat visibility filters:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const reactionsByMessageId = useMemo(
    () => aggregateReactions(reactionRows, currentUserId),
    [reactionRows, currentUserId],
  )

  const visibleMessages = useMemo(
    () =>
      messages.filter((message) => {
        if (message.message_type === 'system') return true
        if (!message.user_id) return true
        if (message.user_id === currentUserId) return true
        return !hiddenAuthorIds.has(message.user_id)
      }),
    [messages, hiddenAuthorIds, currentUserId],
  )

  const chatListItems = useMemo(
    () => buildChatListItems(visibleMessages, { firstUnreadMessageId }),
    [visibleMessages, firstUnreadMessageId],
  )

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const isNearBottom = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return true
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      SCROLL_BOTTOM_THRESHOLD_PX
    )
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
    isAtBottomRef.current = true
    setShowNewMessagesPill(false)
  }, [])

  const appendMessage = useCallback(
    (message: PoolChatMessage) => {
      if (
        message.message_type !== 'system' &&
        message.user_id &&
        message.user_id !== currentUserId &&
        hiddenAuthorIds.has(message.user_id)
      ) {
        return
      }
      setMessages((previous) => {
        if (previous.some((entry) => entry.id === message.id)) return previous
        // Reconcile optimistic bubble for the same author+content still sending.
        if (message.user_id) {
          const optimisticIndex = previous.findIndex(
            (entry) =>
              isOptimisticChatMessageId(entry.id) &&
              entry.user_id === message.user_id &&
              entry.content === message.content &&
              entry.clientStatus === 'sending',
          )
          if (optimisticIndex >= 0) {
            const next = [...previous]
            next[optimisticIndex] = { ...message, clientStatus: null }
            return next
          }
        }
        return [...previous, message]
      })
    },
    [currentUserId, hiddenAuthorIds],
  )

  const loadReactions = useCallback(async () => {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .eq('pool_id', poolId)

    if (error) {
      console.error('Failed to load message reactions:', error.message)
      return
    }

    setReactionRows((data ?? []) as MessageReactionRow[])
  }, [poolId])

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setHasMoreOlder(true)
    setFirstUnreadMessageId(null)
    hasInitialScrolledRef.current = false

    const lastReadAt = await fetchPoolLastReadAt(
      supabase,
      poolId,
      currentUserId,
    )

    const { data, error } = await supabase
      .from('pool_messages')
      .select(MESSAGE_SELECT)
      .eq('pool_id', poolId)
      .order('created_at', { ascending: false })
      .limit(POOL_CHAT_PAGE_SIZE)

    if (error) {
      console.error('Failed to load pool messages:', error.message)
      setLoadError('Could not load messages.')
      setMessages([])
      setHasMoreOlder(false)
    } else {
      const rows = ([...(data ?? [])] as PoolChatMessage[]).reverse()
      setMessages(rows)
      setHasMoreOlder((data?.length ?? 0) >= POOL_CHAT_PAGE_SIZE)
      setFirstUnreadMessageId(
        findFirstUnreadMessageId(rows, lastReadAt, currentUserId),
      )
    }

    await loadReactions()
    setLoading(false)

    const marked = await markPoolRead(supabase, poolId, currentUserId)
    if (marked) emitPoolMarkedRead(poolId)
  }, [poolId, currentUserId, loadReactions])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreOlder) return
    const oldest = messages.find((m) => !isOptimisticChatMessageId(m.id))
    if (!oldest) return

    const container = scrollContainerRef.current
    const prevHeight = container?.scrollHeight ?? 0
    const prevTop = container?.scrollTop ?? 0

    loadingOlderRef.current = true
    isPrependingRef.current = true
    setLoadingOlder(true)

    const { data, error } = await supabase
      .from('pool_messages')
      .select(MESSAGE_SELECT)
      .eq('pool_id', poolId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(POOL_CHAT_PAGE_SIZE)

    if (error) {
      console.error('Failed to load older messages:', error.message)
      toast.error('Could not load older messages')
      setLoadingOlder(false)
      loadingOlderRef.current = false
      isPrependingRef.current = false
      return
    }

    const older = ([...(data ?? [])] as PoolChatMessage[]).reverse()
    setHasMoreOlder((data?.length ?? 0) >= POOL_CHAT_PAGE_SIZE)
    if (older.length > 0) {
      setMessages((previous) => {
        const existing = new Set(previous.map((m) => m.id))
        const unique = older.filter((m) => !existing.has(m.id))
        return [...unique, ...previous]
      })
    }

    setLoadingOlder(false)
    loadingOlderRef.current = false

    requestAnimationFrame(() => {
      const el = scrollContainerRef.current
      if (el) {
        const delta = el.scrollHeight - prevHeight
        el.scrollTop = prevTop + delta
      }
      isPrependingRef.current = false
    })
  }, [hasMoreOlder, messages, poolId])

  useEffect(() => {
    const channel = supabase
      .channel(`pool-messages-${poolId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pool_messages',
          filter: `pool_id=eq.${poolId}`,
        },
        (payload) => {
          appendMessage(payload.new as PoolChatMessage)
          if (document.visibilityState === 'visible') {
            void markPoolRead(supabase, poolId, currentUserId).then((ok) => {
              if (ok) emitPoolMarkedRead(poolId)
            })
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'pool_messages',
          filter: `pool_id=eq.${poolId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string }).id
          if (!deletedId) return
          setMessages((previous) => previous.filter((entry) => entry.id !== deletedId))
          setReactionRows((previous) =>
            previous.filter((row) => row.message_id !== deletedId),
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
          filter: `pool_id=eq.${poolId}`,
        },
        (payload) => {
          const row = payload.new as MessageReactionRow
          setReactionRows((previous) => {
            if (
              previous.some(
                (entry) =>
                  entry.message_id === row.message_id &&
                  entry.user_id === row.user_id &&
                  entry.emoji === row.emoji,
              )
            ) {
              return previous
            }
            return [...previous, row]
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
          filter: `pool_id=eq.${poolId}`,
        },
        (payload) => {
          const old = payload.old as Partial<MessageReactionRow>
          if (!old.message_id || !old.user_id || !old.emoji) return
          setReactionRows((previous) =>
            previous.filter(
              (entry) =>
                !(
                  entry.message_id === old.message_id &&
                  entry.user_id === old.user_id &&
                  entry.emoji === old.emoji
                ),
            ),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [poolId, appendMessage, currentUserId])

  useLayoutEffect(() => {
    if (loading || isPrependingRef.current) return

    if (!hasInitialScrolledRef.current) {
      if (firstUnreadMessageId) {
        const anchor = document.getElementById('pool-chat-unread-anchor')
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'auto', block: 'center' })
          isAtBottomRef.current = isNearBottom()
          hasInitialScrolledRef.current = true
          return
        }
      }
      if (messages.length > 0) {
        scrollToBottom('instant')
      }
      hasInitialScrolledRef.current = true
      return
    }

    if (messages.length === 0) return

    if (isAtBottomRef.current) {
      scrollToBottom('smooth')
    } else {
      setShowNewMessagesPill(true)
    }
  }, [
    loading,
    messages,
    scrollToBottom,
    firstUnreadMessageId,
    isNearBottom,
  ])

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const atBottom = isNearBottom()
    isAtBottomRef.current = atBottom
    if (atBottom) {
      setShowNewMessagesPill(false)
    }

    if (
      container.scrollTop < SCROLL_TOP_LOAD_THRESHOLD_PX &&
      hasMoreOlder &&
      !loadingOlderRef.current &&
      !loading
    ) {
      void loadOlderMessages()
    }
  }, [hasMoreOlder, isNearBottom, loadOlderMessages, loading])

  const persistMessage = useCallback(
    async (optimisticId: string, content: string) => {
      try {
        const res = await fetch(
          `/api/pools/${encodeURIComponent(poolId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          },
        )
        const json = (await res.json()) as {
          message?: PoolChatMessage
          error?: string
        }

        if (!res.ok || !json.message) {
          console.error('Failed to send message:', json.error ?? res.status)
          setMessages((previous) =>
            previous.map((entry) =>
              entry.id === optimisticId
                ? { ...entry, clientStatus: 'failed' }
                : entry,
            ),
          )
          if (res.status === 429) {
            const msg = json.error ?? RATE_LIMIT_MESSAGE
            setSendError(msg)
            toast.error(msg)
          } else {
            const msg =
              typeof json.error === 'string'
                ? json.error
                : 'Could not send message.'
            setSendError(msg)
            toast.error(msg)
          }
          return
        }

        const data = json.message as PoolChatMessage
        setSendError(null)
        setMessages((previous) =>
          previous.map((entry) =>
            entry.id === optimisticId
              ? { ...data, clientStatus: null }
              : entry,
          ),
        )
        capturePostHog('chat_message_sent', {
          pool_id: poolId,
          message_id: data.id,
        })
        void import('@/src/lib/xp-client').then(({ awardClientXp }) => {
          void awardClientXp({
            sourceType: 'pool_chat_first',
            sourceId: poolId,
          })
        })
        void markPoolRead(supabase, poolId, currentUserId).then((ok) => {
          if (ok) emitPoolMarkedRead(poolId)
        })
      } catch (err) {
        console.error('Failed to send message:', err)
        setMessages((previous) =>
          previous.map((entry) =>
            entry.id === optimisticId
              ? { ...entry, clientStatus: 'failed' }
              : entry,
          ),
        )
        setSendError('Could not send message.')
        toast.error('Could not send message.')
      }
    },
    [currentUserId, poolId],
  )

  const sendMessage = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setSendError(null)

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimistic: PoolChatMessage = {
      id: optimisticId,
      pool_id: poolId,
      user_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      message_type: 'user',
      clientStatus: 'sending',
    }
    appendMessage(optimistic)
    setDraft('')
    focusInput()

    await persistMessage(optimisticId, content)
    setSending(false)
  }, [
    appendMessage,
    currentUserId,
    draft,
    focusInput,
    persistMessage,
    poolId,
    sending,
  ])

  const retryFailedMessage = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target || target.clientStatus !== 'failed') return

      setSendError(null)
      setMessages((previous) =>
        previous.map((entry) =>
          entry.id === messageId
            ? { ...entry, clientStatus: 'sending' }
            : entry,
        ),
      )
      await persistMessage(messageId, target.content)
    },
    [messages, persistMessage],
  )

  async function handleSend(event: React.FormEvent) {
    event.preventDefault()
    await sendMessage()
  }

  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  async function handleDelete(messageId: string) {
    if (isOptimisticChatMessageId(messageId)) {
      setMessages((previous) => previous.filter((entry) => entry.id !== messageId))
      return
    }

    setDeletingId(messageId)

    const { error } = await supabase.from('pool_messages').delete().eq('id', messageId)

    setDeletingId(null)

    if (error) {
      console.error('Failed to delete message:', error.message)
      toast.error('Could not delete message', {
        action: {
          label: 'Retry',
          onClick: () => void handleDelete(messageId),
        },
      })
      return
    }

    setMessages((previous) => previous.filter((entry) => entry.id !== messageId))
    setReactionRows((previous) =>
      previous.filter((row) => row.message_id !== messageId),
    )
    capturePostHog('chat_message_deleted', {
      pool_id: poolId,
      message_id: messageId,
    })
  }

  async function submitMessageReport(payload: {
    reason: string
    context: string | null
    reasonPreset: string
  }): Promise<AbuseReportSubmitResult> {
    if (!reportTarget || isOptimisticChatMessageId(reportTarget.id)) {
      return { ok: false, code: 'error', message: 'Invalid message' }
    }

    setReportingId(reportTarget.id)
    setReportNotice(null)

    const { error } = await supabase.from('message_reports').insert({
      pool_id: poolId,
      message_id: reportTarget.id,
      reporter_id: currentUserId,
      reported_author_id: reportTarget.user_id,
      reported_content: reportTarget.content,
      reason: payload.reason,
    })

    setReportingId(null)

    if (error) {
      console.error('Failed to report message:', error.message)
      const msg = error.message.toLowerCase()
      if (msg.includes('already') || msg.includes('duplicate')) {
        return { ok: false, code: 'already_reported' }
      }
      return { ok: false, code: 'error', message: error.message }
    }

    setReportedIds((previous) => new Set(previous).add(reportTarget.id))
    setReportNotice('Thanks — this message has been reported.')
    capturePostHog('message_reported', {
      pool_id: poolId,
      message_id: reportTarget.id,
      reason_preset: payload.reasonPreset,
      reported_author_id: reportTarget.user_id,
    })
    // Keep legacy event for existing dashboards.
    capturePostHog('chat_message_reported', {
      pool_id: poolId,
      message_id: reportTarget.id,
      reason_preset: payload.reasonPreset,
    })
    window.setTimeout(() => setReportNotice(null), 4000)
    setReportTarget(null)
    return { ok: true }
  }

  function openReportDialog(message: PoolChatMessage) {
    if (isOptimisticChatMessageId(message.id)) return
    setReportTarget(message)
    setReportDialogOpen(true)
  }

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (isOptimisticChatMessageId(messageId)) return

      const existing = reactionRows.find(
        (row) =>
          row.message_id === messageId &&
          row.user_id === currentUserId &&
          row.emoji === emoji,
      )

      if (existing) {
        setReactionRows((previous) =>
          previous.filter(
            (row) =>
              !(
                row.message_id === messageId &&
                row.user_id === currentUserId &&
                row.emoji === emoji
              ),
          ),
        )

        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('emoji', emoji)

        if (error) {
          console.error('Failed to remove reaction:', error.message)
          toast.error('Could not update reaction')
          void loadReactions()
        }
        return
      }

      const optimisticRow: MessageReactionRow = {
        message_id: messageId,
        user_id: currentUserId,
        emoji,
      }
      setReactionRows((previous) => [...previous, optimisticRow])

      const { error } = await supabase.from('message_reactions').insert({
        message_id: messageId,
        pool_id: poolId,
        emoji,
      })

      if (error) {
        if (!isDuplicateReactionError(error)) {
          console.error('Failed to add reaction:', error.message)
          toast.error('Could not add reaction')
        }
        setReactionRows((previous) =>
          previous.filter(
            (row) =>
              !(
                row.message_id === messageId &&
                row.user_id === currentUserId &&
                row.emoji === emoji
              ),
          ),
        )
        if (!isDuplicateReactionError(error)) {
          void loadReactions()
        }
        return
      }

      capturePostHog('chat_reaction_added', {
        pool_id: poolId,
        message_id: messageId,
        emoji,
      })
    },
    [currentUserId, loadReactions, poolId, reactionRows],
  )

  const trimmedDraft = draft.trim()
  const canSend = trimmedDraft.length > 0 && !sending
  const showHeading = !hideHeading && !embedded

  return (
    <div
      className={cn(
        'w-full min-w-0',
        fullBleedMobile &&
          'max-sm:flex max-sm:min-h-0 max-sm:w-full max-sm:flex-1 max-sm:flex-col',
        fullBleedDesktop && 'flex h-full min-h-0 flex-1 flex-col',
      )}
    >
      {showHeading ? (
        <div className="mb-4 flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary opacity-30 blur-lg" />
            <MessageCircle className="relative h-6 w-6 text-primary" />
          </div>
          <h2 className="font-display text-2xl tracking-wide text-foreground">
            CHAT
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
        </div>
      ) : null}

      <div
        className={cn(
          'flex flex-col overflow-hidden bg-app-background',
          fullBleedDesktop
            ? 'h-auto min-h-0 flex-1 rounded-none border-0 bg-[#0A0E0E]'
            : cn(
                'rounded-2xl border border-border',
                fullBleedMobile
                  ? 'max-sm:min-h-0 max-sm:flex-1 max-sm:rounded-none max-sm:border-x-0 sm:h-[min(32rem,calc(100dvh-16rem))]'
                  : 'h-[min(32rem,calc(100dvh-16rem))]',
              ),
        )}
      >
        <div
          className={cn(
            'h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary',
            fullBleedDesktop && 'hidden',
          )}
        />

        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col bg-app-background',
            fullBleedDesktop && 'bg-[#0A0E0E]',
          )}
        >
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={cn(
              'min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4',
              fullBleedMobile &&
                'max-sm:overflow-x-hidden max-sm:scrollbar-none max-sm:overscroll-contain max-sm:pt-2',
            )}
          >
            {loadingOlder ? (
              <div className="flex justify-center py-2">
                <Loader2
                  className="h-4 w-4 animate-spin text-primary"
                  aria-label="Loading older messages"
                />
              </div>
            ) : null}

            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-xl bg-muted/40"
                    aria-hidden
                  />
                ))}
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={FOCUS_VISIBLE_RING}
                  onClick={() => void loadMessages()}
                >
                  Try again
                </Button>
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex h-full min-h-[12rem] flex-col items-center justify-center py-8 text-center">
                <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="font-medium text-foreground">No messages yet</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Say hello to your pool — messages appear here for everyone in
                  the group.
                </p>
              </div>
            ) : (
              chatListItems.map((item) =>
                item.type === 'day-divider' ? (
                  <ChatDayDivider key={item.key} label={item.label} />
                ) : item.type === 'unread-divider' ? (
                  <ChatUnreadDivider key={item.key} />
                ) : item.type === 'system' ? (
                  <ChatSystemMoment key={item.key} message={item.message} />
                ) : (
                  <ChatMessageGroup
                    key={item.key}
                    userId={item.group.userId}
                    messages={item.group.messages}
                    currentUserId={currentUserId}
                    memberProfilesByUserId={memberProfilesByUserId}
                    reactionsByMessageId={reactionsByMessageId}
                    isPoolCreator={isPoolCreator}
                    reportedIds={reportedIds}
                    deletingId={deletingId}
                    reportingId={reportingId}
                    onDelete={(messageId) => void handleDelete(messageId)}
                    onReport={(message) => openReportDialog(message)}
                    onToggleReaction={(messageId, emoji) =>
                      void handleToggleReaction(messageId, emoji)
                    }
                    onRetry={(messageId) => void retryFailedMessage(messageId)}
                  />
                ),
              )
            )}
            <div ref={messagesEndRef} aria-hidden />
          </div>

          {showNewMessagesPill ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-[4.75rem] z-10 flex justify-center px-4">
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                className={cn(
                  'pointer-events-auto inline-flex min-h-10 items-center rounded-full border border-primary/30 bg-card/95 px-4 text-sm font-medium text-primary shadow-lg backdrop-blur-sm',
                  FOCUS_VISIBLE_RING,
                )}
              >
                New messages ↓
              </button>
            </div>
          ) : null}

          {reportNotice ? (
            <p className="border-t border-border/60 bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
              {reportNotice}
            </p>
          ) : null}

          <form
            onSubmit={(event) => void handleSend(event)}
            className={cn(
              'flex shrink-0 items-end gap-2 border-t border-border/60 p-3',
              fullBleedMobile &&
                'max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
            )}
          >
            <Textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Message your pool…"
              maxLength={500}
              rows={1}
              className={cn('min-h-10 min-w-0 flex-1 resize-none py-2', FOCUS_VISIBLE_RING)}
              aria-label="Chat message"
            />
            <Button
              type="submit"
              disabled={!canSend}
              className={cn('min-h-10 shrink-0 gap-2', FOCUS_VISIBLE_RING)}
              onMouseDown={(event) => event.preventDefault()}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only sm:not-sr-only">Send</span>
            </Button>
          </form>

          {sendError ? (
            <p className="px-4 pb-3 text-xs text-destructive" role="alert">
              {sendError}
            </p>
          ) : null}
        </div>
      </div>

      <AbuseReportDialog
        open={reportDialogOpen}
        onOpenChange={(next) => {
          setReportDialogOpen(next)
          if (!next) setReportTarget(null)
        }}
        title="Report message"
        description="Tell us what's wrong with this message. Reports are reviewed by the PoolCup team."
        alreadyReportedMessage="You already reported this message."
        onSubmit={submitMessageReport}
      />
    </div>
  )
}
