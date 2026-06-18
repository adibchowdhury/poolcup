'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { LeaderboardMemberAvatar } from '@/components/pool/leaderboard-grouped-list'
import { ChatUnreadCountBadge } from '@/components/chat/chat-unread-count-badge'
import { DashboardAppShell } from '@/components/dashboard/dashboard-app-shell'
import { DashboardDesktopNav } from '@/components/dashboard/dashboard-desktop-nav'
import { cn } from '@/lib/utils'
import {
  fetchPoolChatInbox,
  formatChatMemberNames,
  formatPoolChatLastMessagePreview,
  getVisibleMemberOverflow,
  getVisibleMembers,
  poolChatHasMessage,
  type PoolChatInboxItem,
} from '@/src/lib/pool-chats'
import { formatChatTimestamp } from '@/src/lib/pool-chat-helpers'
import {
  emitPoolMarkedRead,
  getPoolChatHref,
  markPoolRead,
  POOL_MARKED_READ_EVENT,
} from '@/src/lib/pool-unread-counts'
import { supabase } from '@/src/lib/supabase'
import { Tabs } from '@/components/ui/tabs'

type ChatsPageViewProps = {
  userId: string
  email: string
  displayName?: string | null
  avatar?: string | null
}

function ChatInboxRow({
  item,
  userId,
}: {
  item: PoolChatInboxItem
  userId: string
}) {
  const hasUnread = item.unread_count > 0
  const visibleMembers = getVisibleMembers(item.members)
  const overflowCount = getVisibleMemberOverflow(item.member_count)
  const memberNames = formatChatMemberNames(item.members, item.member_count)
  const hasMessage = poolChatHasMessage(item)
  const previewText = formatPoolChatLastMessagePreview(item, userId, item.members)

  return (
    <li>
      <Link
        href={getPoolChatHref(item.inviteCode)}
        onClick={() => {
          void markPoolRead(supabase, item.pool_id, userId)
          emitPoolMarkedRead(item.pool_id)
        }}
        className={cn(
          'flex cursor-pointer gap-3 rounded-xl border border-border/90 bg-card/90 px-4 py-3.5',
          'transition-all duration-200 ease-out',
          'hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-black/25 hover:-translate-y-0.5',
          'active:scale-[0.98] active:border-border active:bg-muted/60 active:shadow-md active:shadow-black/15',
          hasUnread && 'bg-primary/[0.06]',
        )}
      >
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              'text-[15px] leading-snug break-words',
              hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
            )}
          >
            {item.pool_name}
          </h2>

          {visibleMembers.length > 0 ? (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex items-center">
                {visibleMembers.map((member, index) => (
                  <div
                    key={member.memberId}
                    className={cn('ring-2 ring-background', index > 0 && '-ml-2')}
                  >
                    <LeaderboardMemberAvatar
                      member={{
                        name: member.name,
                        avatar: member.avatar,
                        isYou: member.isYou,
                      }}
                      className="h-7 w-7 text-[10px] sm:h-7 sm:w-7"
                      imageClassName="size-7"
                    />
                  </div>
                ))}
                {overflowCount > 0 ? (
                  <span
                    className="-ml-1 pl-2 text-[11px] font-medium tabular-nums text-muted-foreground"
                    aria-label={`${overflowCount} more members`}
                  >
                    +{overflowCount}
                  </span>
                ) : null}
              </div>
              {memberNames ? (
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {memberNames}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-1.5 flex min-w-0 items-baseline gap-2">
            <p
              className={cn(
                'min-w-0 flex-1 truncate text-sm leading-snug',
                hasMessage
                  ? hasUnread
                    ? 'font-medium text-foreground/90'
                    : 'text-muted-foreground'
                  : 'italic text-muted-foreground',
              )}
            >
              {previewText}
            </p>
            {item.last_message_at ? (
              <time
                dateTime={item.last_message_at}
                className={cn(
                  'shrink-0 text-[11px] tabular-nums',
                  hasUnread ? 'font-medium text-primary' : 'text-muted-foreground',
                )}
                suppressHydrationWarning
              >
                {formatChatTimestamp(item.last_message_at)}
              </time>
            ) : null}
          </div>
        </div>

        {hasUnread ? (
          <div className="flex shrink-0 self-center">
            <ChatUnreadCountBadge count={item.unread_count} />
          </div>
        ) : null}
      </Link>
    </li>
  )
}

export function ChatsPageView({
  userId,
  email,
  displayName,
  avatar,
}: ChatsPageViewProps) {
  const [items, setItems] = useState<PoolChatInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadInbox = useCallback(async () => {
    setError(null)
    const rows = await fetchPoolChatInbox(supabase, userId)
    setItems(rows)
    setLoading(false)
  }, [userId])

  const inboxRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    void loadInbox()
  }, [loadInbox])

  useEffect(() => {
    const channel = supabase
      .channel(`chats-inbox-pool-messages-${userId}`)
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
  }, [userId, scheduleInboxRefresh])

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === 'visible') {
        void loadInbox()
      }
    }

    function handlePoolMarkedRead(event: Event) {
      const poolId = (event as CustomEvent<{ poolId: string }>).detail?.poolId
      if (!poolId) return

      setItems((previous) =>
        previous.map((item) =>
          item.pool_id === poolId ? { ...item, unread_count: 0 } : item,
        ),
      )
    }

    window.addEventListener('focus', handleVisible)
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener(POOL_MARKED_READ_EVENT, handlePoolMarkedRead)

    return () => {
      window.removeEventListener('focus', handleVisible)
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener(POOL_MARKED_READ_EVENT, handlePoolMarkedRead)
    }
  }, [loadInbox])

  return (
    <DashboardAppShell
      userId={userId}
      email={email}
      displayName={displayName}
      avatar={avatar}
      mainClassName="py-6 sm:py-8"
    >
      <Tabs value="chat" className="gap-8">
        <DashboardDesktopNav linkDashboardTabs />

        <div className="mx-auto w-full max-w-2xl">
          <h1 className="font-display text-2xl tracking-wide text-foreground uppercase sm:text-3xl">
            Chats
          </h1>

          {loading ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Loading chats…
            </p>
          ) : error ? (
            <p className="mt-8 text-center text-sm text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <div className="mt-12 text-center">
              <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-4 text-base font-medium text-foreground">
                No pool chats yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Join or create a pool to start chatting with your group.
              </p>
              <Link
                href="/dashboard?tab=pools"
                className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                View pools
              </Link>
            </div>
          ) : (
            <ul className="mt-6 flex flex-col gap-2 sm:gap-2.5">
              {items.map((item) => (
                <ChatInboxRow key={item.pool_id} item={item} userId={userId} />
              ))}
            </ul>
          )}
        </div>
      </Tabs>
    </DashboardAppShell>
  )
}
