'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ArrowLeft, MessageCircle, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAvatarSrc } from '@/src/lib/avatars'
import {
  avatarColorClassForUser,
  buildChatListItems,
  formatChatTimestamp,
  initialsFromDisplayName,
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

export function MobilePoolChatThread({
  poolId,
  poolName,
  currentUserId,
  onBack,
}: MobilePoolChatThreadProps) {
  const [messages, setMessages] = useState<PoolChatMessage[]>([])
  const [memberProfiles, setMemberProfiles] = useState<
    Map<string, PoolChatMemberProfile>
  >(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const hasInitialScrolledRef = useRef(false)

  const chatListItems = useMemo(() => buildChatListItems(messages), [messages])

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
  }, [])

  const loadThread = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const [messagesResult, profiles] = await Promise.all([
      supabase
        .from('pool_messages')
        .select('id, pool_id, user_id, content, created_at')
        .eq('pool_id', poolId)
        .order('created_at', { ascending: true }),
      fetchPoolChatMemberProfiles(supabase, poolId),
    ])

    if (messagesResult.error) {
      setLoadError('Could not load messages.')
      setMessages([])
    } else {
      setMessages((messagesResult.data ?? []) as PoolChatMessage[])
    }

    setMemberProfiles(profiles)
    setLoading(false)
    hasInitialScrolledRef.current = false
  }, [poolId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void loadThread()
  }, [loadThread])

  useEffect(() => {
    const channel = supabase
      .channel(`mobile-pool-messages-${poolId}`)
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
    }
  }, [loading, messages, scrollToBottom])

  const handleScroll = useCallback(() => {
    isAtBottomRef.current = isNearBottom()
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
  }, [
    appendMessage,
    currentUserId,
    draft,
    poolId,
    scrollToBottom,
    sending,
  ])

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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border/60 bg-card/30">
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
            chatListItems.map((item) => {
              if (item.type === 'day-divider') {
                return <ChatDayDivider key={item.key} label={item.label} />
              }

              const group = item.group
              const isYou = group.userId === currentUserId
              const author = resolveAuthor(group.userId, memberProfiles)
              const firstMessage = group.messages[0]!

              return (
                <div
                  key={item.key}
                  className={cn('flex w-full min-w-0', !isYou && 'gap-2')}
                >
                  {!isYou ? (
                    <ChatAvatar
                      userId={group.userId}
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

                    {group.messages.map((message, index) => (
                      <div
                        key={message.id}
                        className={cn(
                          'max-w-[min(100%,18rem)] rounded-2xl px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap',
                          isYou
                            ? 'rounded-tr-md bg-primary/20 text-foreground ring-1 ring-primary/35'
                            : 'rounded-tl-md bg-muted/60 text-foreground',
                          index > 0 ? 'mt-0.5' : 'mt-1',
                        )}
                      >
                        {message.content}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} aria-hidden />
        </div>

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
