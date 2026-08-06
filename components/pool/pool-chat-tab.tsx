'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Flag, MessageCircle, MoreHorizontal, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { emitPoolMarkedRead, markPoolRead } from '@/src/lib/pool-unread-counts'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import {
  ALLOWED_CHAT_REACTIONS,
  aggregateReactions,
  buildChatListItems,
  formatChatTimestamp,
  isDuplicateReactionError,
  type AggregatedReaction,
  type MessageReactionRow,
  type PoolChatMessage,
} from '@/src/lib/pool-chat-helpers'
import { supabase } from '@/src/lib/supabase'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { ChatSystemMoment } from '@/components/pool/chat-system-moment'

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
      className="mb-0.5 shrink-0"
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
  /** When true, render member avatar beside the bubble (others only). */
  showAvatar?: boolean
  authorUserId?: string
  author?: PoolChatMemberProfile
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showActions = canDelete || canReport
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
      {/* Avatar + bubble only — reactions sit below so they never shift alignment */}
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
}) {
  const isYou = userId === currentUserId
  const author = resolveAuthor(userId, memberProfilesByUserId)
  const firstMessage = messages[0]!

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
            className="text-xs font-semibold text-foreground hover:underline"
          >
            {author.displayName}
          </UserProfileLink>
        )}
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
        const isLast = index === messages.length - 1

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
}: PoolChatTabProps) {
  const [messages, setMessages] = useState<PoolChatMessage[]>([])
  const [reactionRows, setReactionRows] = useState<MessageReactionRow[]>([])
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isAtBottomRef = useRef(true)
  const hasInitialScrolledRef = useRef(false)
  const isPoolCreator = currentUserId === poolCreatorUserId
  const { setOpenChatPoolId } = useMobileChatChrome()

  useEffect(() => {
    setOpenChatPoolId(poolId)
    return () => {
      setOpenChatPoolId(null)
    }
  }, [poolId, setOpenChatPoolId])

  const reactionsByMessageId = useMemo(
    () => aggregateReactions(reactionRows, currentUserId),
    [reactionRows, currentUserId],
  )

  const chatListItems = useMemo(() => buildChatListItems(messages), [messages])

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

  const appendMessage = useCallback((message: PoolChatMessage) => {
    setMessages((previous) => {
      if (previous.some((entry) => entry.id === message.id)) return previous
      return [...previous, message]
    })
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

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const { data, error } = await supabase
      .from('pool_messages')
      .select('id, pool_id, user_id, content, created_at, message_type, metadata')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to load pool messages:', error.message)
      setLoadError('Could not load messages.')
      setMessages([])
    } else {
      setMessages((data ?? []) as PoolChatMessage[])
    }

    await loadReactions()
    setLoading(false)
    hasInitialScrolledRef.current = false
  }, [poolId, loadReactions])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const marked = await markPoolRead(supabase, poolId, currentUserId)
      if (cancelled || !marked) return
      emitPoolMarkedRead(poolId)
    })()

    return () => {
      cancelled = true
    }
  }, [poolId])

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
  }, [poolId, appendMessage])

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
      .select('id, pool_id, user_id, content, created_at, message_type, metadata')
      .single()

    setSending(false)

    if (error) {
      console.error('Failed to send message:', error.message)
      setSendError('Could not send message.')
      focusInput()
      return
    }

    if (data) {
      appendMessage(data as PoolChatMessage)
    }
    setDraft('')
    focusInput()
  }, [appendMessage, currentUserId, draft, focusInput, poolId, sending])

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
    setDeletingId(messageId)

    const { error } = await supabase.from('pool_messages').delete().eq('id', messageId)

    setDeletingId(null)

    if (error) {
      console.error('Failed to delete message:', error.message)
      return
    }

    setMessages((previous) => previous.filter((entry) => entry.id !== messageId))
    setReactionRows((previous) =>
      previous.filter((row) => row.message_id !== messageId),
    )
  }

  async function handleReport(message: PoolChatMessage) {
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
  }

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
  const showHeading = !hideHeading && !embedded

  return (
    <div
      className={cn(
        'w-full min-w-0',
        fullBleedMobile &&
          'max-sm:flex max-sm:min-h-0 max-sm:w-full max-sm:flex-1 max-sm:flex-col',
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
          'flex flex-col overflow-hidden rounded-2xl border border-border bg-[#131313]',
          fullBleedMobile
            ? 'max-sm:min-h-0 max-sm:flex-1 max-sm:rounded-none max-sm:border-x-0 sm:h-[min(32rem,calc(100dvh-16rem))]'
            : 'h-[min(32rem,calc(100dvh-16rem))]',
        )}
      >
        <div className="h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary" />

        <div className="relative flex min-h-0 flex-1 flex-col bg-[#131313]">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={cn(
              'min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4',
              fullBleedMobile &&
                'max-sm:overflow-x-hidden max-sm:scrollbar-none max-sm:overscroll-contain max-sm:pt-2',
            )}
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

          <form
            onSubmit={(event) => void handleSend(event)}
            className={cn(
              'flex shrink-0 items-end gap-2 border-t border-border/60 p-3',
              fullBleedMobile && 'max-sm:px-4 max-sm:py-3',
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
              className="min-h-10 min-w-0 flex-1 resize-none py-2"
              aria-label="Chat message"
            />
            <Button
              type="submit"
              disabled={!canSend}
              className="min-h-10 shrink-0 gap-2"
              onMouseDown={(event) => event.preventDefault()}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Send</span>
            </Button>
          </form>

          {sendError ? (
            <p className="px-4 pb-3 text-xs text-destructive">{sendError}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
