'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  fetchPoolChatInbox,
  formatPoolChatLastMessagePreview,
  poolChatHasMessage,
  type PoolChatInboxItem,
} from '@/src/lib/pool-chats'
import { formatChatTimestamp } from '@/src/lib/pool-chat-helpers'
import { MobilePoolChatThread } from './mobile-pool-chat-thread'
import { supabase } from '../lib/supabase-mobile'

export type ChatView = 'list' | 'thread'

type MobileChatTabProps = {
  view: ChatView
  selectedPool: PoolChatInboxItem | null
  onOpenThread: (pool: PoolChatInboxItem) => void
  onCloseThread: () => void
}

function ChatInboxRow({
  item,
  userId,
  onOpen,
}: {
  item: PoolChatInboxItem
  userId: string
  onOpen: () => void
}) {
  const hasMessage = poolChatHasMessage(item)
  const previewText = formatPoolChatLastMessagePreview(item, userId, item.members)

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full cursor-pointer gap-3 rounded-xl border border-border/90 bg-card/90 px-4 py-3.5 text-left transition-colors',
          'hover:border-border hover:bg-card',
        )}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium leading-snug break-words text-foreground">
            {item.pool_name}
          </h3>
          <div className="mt-1.5 flex min-w-0 items-baseline gap-2">
            <p
              className={cn(
                'min-w-0 flex-1 truncate text-sm leading-snug',
                hasMessage
                  ? 'text-muted-foreground'
                  : 'italic text-muted-foreground',
              )}
            >
              {previewText}
            </p>
            {item.last_message_at ? (
              <time
                dateTime={item.last_message_at}
                className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                suppressHydrationWarning
              >
                {formatChatTimestamp(item.last_message_at)}
              </time>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  )
}

export function MobileChatTab({
  view,
  selectedPool,
  onOpenThread,
  onCloseThread,
}: MobileChatTabProps) {
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<PoolChatInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inboxRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadInbox = useCallback(async () => {
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(userError?.message ?? 'Could not load your account')
      setItems([])
      setLoading(false)
      return
    }

    setUserId(user.id)
    const rows = await fetchPoolChatInbox(supabase, user.id)
    setItems(rows)
    setLoading(false)
  }, [])

  const scheduleInboxRefresh = useCallback(() => {
    if (inboxRefreshTimerRef.current) {
      clearTimeout(inboxRefreshTimerRef.current)
    }

    inboxRefreshTimerRef.current = setTimeout(() => {
      inboxRefreshTimerRef.current = null
      void loadInbox()
    }, 400)
  }, [loadInbox])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void loadInbox()
  }, [loadInbox])

  useEffect(() => {
    if (!userId || view !== 'list') return

    const channel = supabase
      .channel(`mobile-chats-inbox-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pool_messages',
        },
        () => {
          scheduleInboxRefresh()
        },
      )
      .subscribe()

    return () => {
      if (inboxRefreshTimerRef.current) {
        clearTimeout(inboxRefreshTimerRef.current)
        inboxRefreshTimerRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [userId, view, scheduleInboxRefresh])

  if (view === 'thread' && selectedPool && userId) {
    return (
      <MobilePoolChatThread
        poolId={selectedPool.pool_id}
        poolName={selectedPool.pool_name}
        currentUserId={userId}
        onBack={onCloseThread}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
      <div className="mx-auto w-full max-w-lg">
        <h2 className="font-display text-2xl tracking-wide text-foreground uppercase">
          Chats
        </h2>

        {loading ? (
          <div className="mt-6 space-y-2.5" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-xl bg-muted/40"
              />
            ))}
          </div>
        ) : error ? (
          <p className="mt-8 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="mt-12 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-4 text-base font-medium text-foreground">
              No pool chats yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Join or create a pool to start chatting with your group.
            </p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-2.5">
            {items.map((item) => (
              <ChatInboxRow
                key={item.pool_id}
                item={item}
                userId={userId ?? ''}
                onOpen={() => onOpenThread(item)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
