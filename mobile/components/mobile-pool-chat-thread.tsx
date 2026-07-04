'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ArrowLeft, Flag, MessageCircle, MoreHorizontal, Send } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { getAvatarSrc } from '@/src/lib/avatars'
import { markPoolRead } from '@/src/lib/pool-unread-counts'
import {
  ALLOWED_CHAT_REACTIONS,
  aggregateReactions,
  avatarColorClassForUser,
  buildChatListItems,
  formatChatTimestamp,
  initialsFromDisplayName,
  isDuplicateReactionError,
  type AggregatedReaction,
  type MessageReactionRow,
  type PoolChatMessage,
} from '@/src/lib/pool-chat-helpers'
import {
  fetchPoolChatMemberProfiles,
  type PoolChatMemberProfile,
} from '../lib/fetch-pool-chat-members'
import { supabase } from '../lib/supabase-mobile'

type MobilePoolChatThreadProps = {
  poolId: string
  poolName: string
  currentUserId: string
  onBack: () => void
}

const LONG_PRESS_MS = 450
const SCROLL_BOTTOM_THRESHOLD_PX = 48

function resolveAuthor(
  userId: string,
  profiles: Map<string, PoolChatMemberProfile>,
): PoolChatMemberProfile {
  return (
    profiles.get(userId) ?? {
      displayName: 'Member',
      avatar: null,
    }
  )
}

function ChatAvatar({
  userId,
  displayName,
  avatar,
}: {
  userId: string
  displayName: string
  avatar: string | null
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(avatar?.trim()) && !imageFailed

  if (showImage) {
    return (
      <img
        src={getAvatarSrc(avatar)}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-card"
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-card',
        avatarColorClassForUser(userId),
      )}
      aria-hidden
    >
      {initialsFromDisplayName(displayName)}
    </div>
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
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showActions = canDelete || canReport

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
        'group/message relative flex w-full min-w-0 max-w-full',
        isYou ? 'justify-end' : 'justify-start',
        stacked ? 'mt-0.5' : 'mt-1',
      )}
      onTouchStart={showActions ? startLongPress : undefined}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <div
        className={cn(
          'relative max-w-[min(100%,18rem)]',
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
                    'opacity-100',
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
                      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-lg hover:bg-muted"
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

        {reactions.length > 0 ? (
          <div
            className={cn(
              'mt-1 flex flex-wrap gap-1',
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
    </div>
  )
}

function ChatMessageGroup({
  userId,
  messages,
  currentUserId,
  memberProfiles,
  reactionsByMessageId,
  isPoolCreator,
  reportedIds,
  deletingId,
  reportingId,
  onDelete,
  onReport,
  onToggleReaction,
}: {
  userId: string
  messages: PoolChatMessage[]
  currentUserId: string
  memberProfiles: Map<string, PoolChatMemberProfile>
  reactionsByMessageId: Map<string, AggregatedReaction[]>
  isPoolCreator: boolean
  reportedIds: Set<string>
  deletingId: string | null
  reportingId: string | null
  onDelete: (messageId: string) => void
  onReport: (message: PoolChatMessage) => void
  onToggleReaction: (messageId: string, emoji: string) => void
}) {
  const isYou = userId === currentUserId
  const author = resolveAuthor(userId, memberProfiles)
  const firstMessage = messages[0]!

  return (
    <div className={cn('flex w-full min-w-0', !isYou && 'gap-2')}>
      {!isYou ? (
        <ChatAvatar
          userId={userId}
          displayName={author.displayName}
          avatar={author.avatar}
        />
      ) : null}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          isYou ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'mb-0.5 flex items-center gap-2',
            isYou ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <span
            className={cn(
              'text-xs font-semibold',
              isYou ? 'text-primary' : 'text-foreground',
            )}
          >
            {isYou ? 'You' : author.displayName}
          </span>
          <time
            className="text-[10px] text-muted-foreground"
            dateTime={firstMessage.created_at}
            suppressHydrationWarning
          >
            {formatChatTimestamp(firstMessage.created_at)}
          </time>
        </div>

        {messages.map((message, index) => {
          const canDelete = isYou || isPoolCreator
          const canReport = !isYou

          return (
            <ChatMessageBubble
              key={message.id}
              message={message}
              isYou={isYou}
              stacked={index > 0}
              reactions={reactionsByMessageId.get(message.id) ?? []}
              canDelete={canDelete}
              canReport={canReport}
              reported={reportedIds.has(message.id)}
              deleting={deletingId === message.id}
              reporting={reportingId === message.id}
              onDelete={() => onDelete(message.id)}
              onReport={() => onReport(message)}
              onToggleReaction={(emoji) => onToggleReaction(message.id, emoji)}
            />
          )
        })}
      </div>
    </div>
  )
}

export function MobilePoolChatThread({
  poolId,
  poolName,
  currentUserId,
  onBack,
}: MobilePoolChatThreadProps) {
  const [messages, setMessages] = useState<PoolChatMessage[]>([])
  const [reactionRows, setReactionRows] = useState<MessageReactionRow[]>([])
  const [memberProfiles, setMemberProfiles] = useState<
    Map<string, PoolChatMemberProfile>
  >(new Map())
  const [poolCreatorUserId, setPoolCreatorUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set())
  const [reportNotice, setReportNotice] = useState<string | null>(null)
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const hasInitialScrolledRef = useRef(false)

  const isPoolCreator = currentUserId === poolCreatorUserId

  const reactionsByMessageId = useMemo(
    () => aggregateReactions(reactionRows, currentUserId),
    [reactionRows, currentUserId],
  )

  const chatListItems = useMemo(() => buildChatListItems(messages), [messages])

  const markThreadRead = useCallback(async () => {
    await markPoolRead(supabase, poolId, currentUserId)
  }, [poolId, currentUserId])

  const appendMessage = useCallback((message: PoolChatMessage) => {
    setMessages((previous) => {
      if (previous.some((entry) => entry.id === message.id)) return previous
      return [...previous, message]
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

  const loadThread = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const [messagesResult, profiles, poolResult] = await Promise.all([
      supabase
        .from('pool_messages')
        .select('id, pool_id, user_id, content, created_at')
        .eq('pool_id', poolId)
        .order('created_at', { ascending: true }),
      fetchPoolChatMemberProfiles(supabase, poolId),
      supabase.from('pools').select('creator_id').eq('id', poolId).maybeSingle(),
    ])

    if (messagesResult.error) {
      setLoadError('Could not load messages.')
      setMessages([])
    } else {
      setMessages((messagesResult.data ?? []) as PoolChatMessage[])
    }

    setMemberProfiles(profiles)
    setPoolCreatorUserId(poolResult.data?.creator_id ?? '')
    await loadReactions()
    setLoading(false)
    hasInitialScrolledRef.current = false
  }, [poolId, loadReactions])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void loadThread()
  }, [loadThread])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    void (async () => {
      const marked = await markPoolRead(supabase, poolId, currentUserId)
      if (cancelled || !marked) return
    })()

    return () => {
      cancelled = true
    }
  }, [poolId, currentUserId])

  useEffect(() => {
    if (typeof window === 'undefined') return

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
          void markThreadRead()
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
  }, [poolId, appendMessage, markThreadRead])

  useLayoutEffect(() => {
    if (loading || messages.length === 0) return

    if (!hasInitialScrolledRef.current) {
      scrollToBottom('instant')
      hasInitialScrolledRef.current = true
      return
    }

    if (isAtBottomRef.current) {
      scrollToBottom('smooth')
    } else {
      setShowNewMessagesPill(true)
    }
  }, [loading, messages, scrollToBottom])

  const handleScroll = useCallback(() => {
    const atBottom = isNearBottom()
    isAtBottomRef.current = atBottom
    if (atBottom) {
      setShowNewMessagesPill(false)
    }
  }, [isNearBottom])

  const sendMessage = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setSendError(null)

    const { data, error } = await supabase
      .from('pool_messages')
      .insert({
        pool_id: poolId,
        user_id: currentUserId,
        content,
      })
      .select('id, pool_id, user_id, content, created_at')
      .single()

    setSending(false)

    if (error) {
      console.error('Failed to send message:', error.message)
      setSendError('Could not send message.')
      return
    }

    if (data) {
      appendMessage(data as PoolChatMessage)
    }
    setDraft('')
    scrollToBottom('smooth')
    void markThreadRead()
  }, [
    appendMessage,
    currentUserId,
    draft,
    markThreadRead,
    poolId,
    scrollToBottom,
    sending,
  ])

  const handleDelete = useCallback(
    async (messageId: string) => {
      setDeletingId(messageId)

      const { error } = await supabase
        .from('pool_messages')
        .delete()
        .eq('id', messageId)

      setDeletingId(null)

      if (error) {
        console.error('Failed to delete message:', error.message)
        return
      }

      setMessages((previous) => previous.filter((entry) => entry.id !== messageId))
      setReactionRows((previous) =>
        previous.filter((row) => row.message_id !== messageId),
      )
    },
    [],
  )

  const handleReport = useCallback(
    async (message: PoolChatMessage) => {
      setReportingId(message.id)
      setReportNotice(null)

      const { error } = await supabase.from('message_reports').insert({
        pool_id: poolId,
        message_id: message.id,
        reporter_id: currentUserId,
        reported_author_id: message.user_id,
        reported_content: message.content,
      })

      setReportingId(null)

      if (error) {
        console.error('Failed to report message:', error.message)
        return
      }

      setReportedIds((previous) => new Set(previous).add(message.id))
      setReportNotice('Thanks — this message has been reported.')
      window.setTimeout(() => setReportNotice(null), 4000)
    },
    [currentUserId, poolId],
  )

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
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
      }
    },
    [currentUserId, loadReactions, poolId, reactionRows],
  )

  const trimmedDraft = draft.trim()
  const canSend = trimmedDraft.length > 0 && !sending

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-label="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl tracking-wide text-foreground">
            {poolName}
          </h2>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border/60 bg-card/30">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
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
            <p className="py-8 text-center text-sm text-destructive">{loadError}</p>
          ) : messages.length === 0 ? (
            <div className="flex min-h-[12rem] flex-col items-center justify-center py-8 text-center">
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
              ) : (
                <ChatMessageGroup
                  key={item.key}
                  userId={item.group.userId}
                  messages={item.group.messages}
                  currentUserId={currentUserId}
                  memberProfiles={memberProfiles}
                  reactionsByMessageId={reactionsByMessageId}
                  isPoolCreator={isPoolCreator}
                  reportedIds={reportedIds}
                  deletingId={deletingId}
                  reportingId={reportingId}
                  onDelete={(messageId) => void handleDelete(messageId)}
                  onReport={(message) => void handleReport(message)}
                  onToggleReaction={(messageId, emoji) =>
                    void handleToggleReaction(messageId, emoji)
                  }
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
              className="pointer-events-auto inline-flex min-h-10 items-center rounded-full border border-primary/30 bg-card/95 px-4 text-sm font-medium text-primary shadow-lg backdrop-blur-sm"
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

        <div className="shrink-0 border-t border-border/60 bg-background p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder="Message your pool…"
              maxLength={500}
              rows={1}
              aria-label="Chat message"
              className="min-h-10 min-w-0 flex-1 resize-none rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
            />
            <button
              type="button"
              disabled={!canSend}
              onClick={() => void sendMessage()}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
              <span className="sr-only">Send</span>
            </button>
          </div>
          {sendError ? (
            <p className="mt-2 text-xs text-destructive">{sendError}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
