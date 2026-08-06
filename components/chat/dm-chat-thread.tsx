'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { cn } from '@/lib/utils'
import {
  emitDmMarkedRead,
  fetchDmMessages,
  fetchMyDmConversations,
  markDmRead,
  sendDm,
  type DmConversationRow,
  type DmMessageRow,
} from '@/src/lib/dm-chats'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import {
  buildChatListItems,
  formatChatTimestamp,
  type PoolChatMessage,
} from '@/src/lib/pool-chat-helpers'
import { CHAT_INBOX_HREF } from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'
import { hrefForUser } from '@/src/lib/user-profile-href'

const SCROLL_BOTTOM_THRESHOLD_PX = 48
const DM_MESSAGE_LIMIT = 200

type DmChatThreadProps = {
  conversationId: string
  currentUserId: string
  initialConversation?: DmConversationRow | null
}

function toPoolShape(message: DmMessageRow): PoolChatMessage {
  return {
    id: message.id,
    pool_id: '',
    user_id: message.sender_id,
    content: message.content,
    created_at: message.created_at,
    message_type: 'user',
    metadata: null,
  }
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

function DmBubble({
  message,
  isYou,
  stacked,
}: {
  message: DmMessageRow
  isYou: boolean
  stacked: boolean
}) {
  return (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-full',
        isYou ? 'justify-end' : 'justify-start',
        stacked ? 'mt-0.5' : 'mt-1',
      )}
    >
      <div className="max-w-[min(100%,18rem)] sm:max-w-[min(100%,22rem)]">
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
        <p
          className={cn(
            'mt-1 text-[10px] tabular-nums text-muted-foreground/70',
            isYou ? 'text-right' : 'text-left',
          )}
          suppressHydrationWarning
        >
          {formatChatTimestamp(message.created_at)}
        </p>
      </div>
    </div>
  )
}

export function DmChatThread({
  conversationId,
  currentUserId,
  initialConversation = null,
}: DmChatThreadProps) {
  const { setOpenDmConversationId, setMobileChatActive } = useMobileChatChrome()
  const [conversation, setConversation] = useState<DmConversationRow | null>(
    initialConversation,
  )
  const [messages, setMessages] = useState<DmMessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const isAtBottomRef = useRef(true)
  const hasInitialScrolledRef = useRef(false)

  const stillFriends = conversation?.still_friends !== false
  const otherName = conversation?.other_display_name?.trim() || 'Friend'

  useEffect(() => {
    setOpenDmConversationId(conversationId)
    return () => {
      setOpenDmConversationId(null)
    }
  }, [conversationId, setOpenDmConversationId])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)')
    const sync = () => setMobileChatActive(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => {
      mediaQuery.removeEventListener('change', sync)
      setMobileChatActive(false)
    }
  }, [setMobileChatActive])

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
    isAtBottomRef.current = true
    setShowNewMessagesPill(false)
  }, [])

  const appendMessage = useCallback((message: DmMessageRow) => {
    setMessages((previous) => {
      if (previous.some((entry) => entry.id === message.id)) {
        return previous
      }

      const withoutOptimistic = previous.filter((entry) => {
        if (!entry.id.startsWith('optimistic-')) return true
        return !(
          entry.sender_id === message.sender_id &&
          entry.content === message.content
        )
      })

      return [...withoutOptimistic, message]
    })
  }, [])

  const loadConversationMeta = useCallback(async () => {
    const rows = await fetchMyDmConversations(supabase)
    const match = rows.find((row) => row.conversation_id === conversationId) ?? null
    if (match) {
      setConversation(match)
    } else if (!initialConversation) {
      setConversation(null)
    }
  }, [conversationId, initialConversation])

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const rows = await fetchDmMessages(supabase, conversationId, DM_MESSAGE_LIMIT)
    setMessages(rows)
    if (rows.length === 0) {
      // Empty is valid; keep loadError null unless RPC failed (fetch returns []).
    }
    setLoading(false)
    hasInitialScrolledRef.current = false
  }, [conversationId])

  useEffect(() => {
    void loadConversationMeta()
    void loadMessages()
  }, [loadConversationMeta, loadMessages])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const marked = await markDmRead(supabase, conversationId)
      if (cancelled || !marked) return
      emitDmMarkedRead(conversationId)
    })()

    return () => {
      cancelled = true
    }
  }, [conversationId])

  useEffect(() => {
    const channel = supabase
      .channel(`dm-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as DmMessageRow & { conversation_id?: string }
          if (!row.id || !row.sender_id || row.content == null || !row.created_at) {
            return
          }
          appendMessage({
            id: row.id,
            sender_id: row.sender_id,
            content: row.content,
            created_at: row.created_at,
          })
          void (async () => {
            const marked = await markDmRead(supabase, conversationId)
            if (marked) emitDmMarkedRead(conversationId)
          })()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [appendMessage, conversationId])

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

  const focusInput = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const sendMessage = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending || !stillFriends) return

    setSending(true)
    setSendError(null)

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimistic: DmMessageRow = {
      id: optimisticId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
    }
    appendMessage(optimistic)
    setDraft('')
    focusInput()

    const result = await sendDm(supabase, conversationId, content)
    setSending(false)

    if (result.notFriends) {
      setMessages((previous) => previous.filter((entry) => entry.id !== optimisticId))
      setConversation((previous) =>
        previous ? { ...previous, still_friends: false } : previous,
      )
      setSendError("You can't message this person")
      setDraft(content)
      return
    }

    if (result.error || !result.messageId) {
      setMessages((previous) => previous.filter((entry) => entry.id !== optimisticId))
      setSendError('Could not send message.')
      setDraft(content)
      focusInput()
      return
    }

    setMessages((previous) =>
      previous.map((entry) =>
        entry.id === optimisticId
          ? { ...entry, id: result.messageId as string }
          : entry,
      ),
    )
  }, [
    appendMessage,
    conversationId,
    currentUserId,
    draft,
    focusInput,
    sending,
    stillFriends,
  ])

  function handleSend(event: React.FormEvent) {
    event.preventDefault()
    void sendMessage()
  }

  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  const chatListItems = useMemo(
    () => buildChatListItems(messages.map(toPoolShape)),
    [messages],
  )

  const messagesById = useMemo(() => {
    const map = new Map<string, DmMessageRow>()
    for (const message of messages) {
      map.set(message.id, message)
    }
    return map
  }, [messages])

  const trimmedDraft = draft.trim()
  const canSend = stillFriends && trimmedDraft.length > 0 && !sending

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col max-sm:min-h-[calc(100dvh-5.5rem)] sm:gap-4">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-1 pb-3 sm:border-0 sm:px-0 sm:pb-0">
        <Link
          href={CHAT_INBOX_HREF}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-label="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {conversation ? (
          <UserProfileLink
            userId={conversation.other_user_id}
            ariaLabel={`${otherName}'s profile`}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <UserAvatarImage
              avatar={conversation.other_avatar}
              customAvatarUrl={conversation.other_custom_avatar_url}
              className="h-10 w-10"
            />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-foreground">
                {otherName}
              </p>
              {!stillFriends ? (
                <p className="truncate text-xs text-muted-foreground">
                  No longer friends
                </p>
              ) : (
                <p className="truncate text-xs text-muted-foreground">
                  View profile
                </p>
              )}
            </div>
          </UserProfileLink>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-foreground">Direct message</p>
          </div>
        )}
      </header>

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-card',
          'max-sm:rounded-none max-sm:border-0',
          'sm:h-[min(36rem,calc(100dvh-14rem))] sm:rounded-2xl sm:border',
        )}
      >
        <div className="hidden h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary sm:block" />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 max-sm:scrollbar-none max-sm:overscroll-contain"
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
                  Say hello — your conversation starts here.
                </p>
              </div>
            ) : (
              chatListItems.map((item) => {
                if (item.type === 'day-divider') {
                  return <ChatDayDivider key={item.key} label={item.label} />
                }

                // DMs never emit system moments; skip for type exhaustiveness.
                if (item.type === 'system') return null

                const isYou = item.group.userId === currentUserId
                return (
                  <div
                    key={item.key}
                    className={cn('flex gap-2', isYou ? 'justify-end' : 'justify-start')}
                  >
                    {!isYou && conversation ? (
                      <Link
                        href={hrefForUser(conversation.other_user_id)}
                        className="mt-auto shrink-0 self-end"
                        aria-label={`${otherName}'s profile`}
                      >
                        <UserAvatarImage
                          avatar={conversation.other_avatar}
                          customAvatarUrl={conversation.other_custom_avatar_url}
                          className="h-8 w-8"
                        />
                      </Link>
                    ) : null}
                    <div className="min-w-0">
                      {item.group.messages.map((poolMessage, index) => {
                        const message = messagesById.get(poolMessage.id)
                        if (!message) return null
                        return (
                          <DmBubble
                            key={message.id}
                            message={message}
                            isYou={isYou}
                            stacked={index > 0}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })
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

          {!stillFriends ? (
            <p className="border-t border-border/60 bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
              You can&apos;t message this person
            </p>
          ) : (
            <form
              onSubmit={handleSend}
              className="flex shrink-0 items-end gap-2 border-t border-border/60 p-3 max-sm:px-4"
            >
              <Textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Message…"
                maxLength={500}
                rows={1}
                className="min-h-10 min-w-0 flex-1 resize-none py-2"
                aria-label="Direct message"
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
          )}

          {sendError ? (
            <p className="px-4 pb-3 text-xs text-destructive">{sendError}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
