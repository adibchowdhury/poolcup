'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MessageCircle, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { ChatInboxSkeleton } from '@/components/chat/chat-inbox-skeleton'
import { ChatUnreadCountBadge } from '@/components/chat/chat-unread-count-badge'
import { DashboardAppShell } from '@/components/dashboard/dashboard-app-shell'
import { DashboardDesktopNav } from '@/components/dashboard/dashboard-desktop-nav'
import { Input } from '@/components/ui/input'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { cn } from '@/lib/utils'
import {
  DM_MARKED_READ_EVENT,
  emitDmMarkedRead,
  fetchMyDmConversations,
  firstNameFromDisplayName,
  formatDmLastMessagePreview,
  getDmChatHref,
  getOrCreateDm,
  markDmRead,
  type DmConversationRow,
} from '@/src/lib/dm-chats'
import {
  fetchPoolChatInbox,
  formatPoolChatLastMessagePreview,
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
import { getMyFriends, type FriendRow } from '@/src/lib/friendships'
import { supabase } from '@/src/lib/supabase'
import { Tabs } from '@/components/ui/tabs'

type ChatsPageViewProps = {
  userId: string
  email: string
  displayName?: string | null
  avatar?: string | null
  customAvatarUrl?: string | null
}

type UnifiedInboxItem =
  | {
      kind: 'pool'
      sortAt: number
      pool: PoolChatInboxItem
    }
  | {
      kind: 'dm'
      sortAt: number
      dm: DmConversationRow
    }

function activityTimeMs(iso: string | null | undefined): number {
  if (!iso) return 0
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

/** Shared row shell — pool group chats and 1:1 DMs. */
function ChatListRowShell({
  href,
  onNavigate,
  avatar,
  title,
  preview,
  previewEmpty,
  timestamp,
  timestampIso,
  unreadCount,
  muted,
}: {
  href: string
  onNavigate?: () => void
  avatar: ReactNode
  title: string
  preview: string
  previewEmpty?: boolean
  timestamp?: string | null
  timestampIso?: string | null
  unreadCount: number
  muted?: boolean
}) {
  const hasUnread = unreadCount > 0

  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-4 px-1 py-3 transition-colors sm:px-1.5',
          'hover:bg-muted/30 active:bg-muted/45',
          muted && 'opacity-70',
        )}
      >
        <div className="shrink-0 self-center">{avatar}</div>

        <div className="min-w-0 flex-1 space-y-1">
          <h2
            className={cn(
              'truncate text-[16px] leading-tight text-foreground',
              hasUnread ? 'font-semibold' : 'font-medium',
            )}
          >
            {title}
          </h2>

          <p
            className={cn(
              'truncate text-[13px] leading-snug',
              previewEmpty
                ? 'italic text-muted-foreground/65'
                : 'text-muted-foreground',
            )}
          >
            {preview}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 self-stretch pt-0.5">
          {timestamp && timestampIso ? (
            <time
              dateTime={timestampIso}
              className="text-[11px] leading-none tabular-nums text-muted-foreground/75"
              suppressHydrationWarning
            >
              {timestamp}
            </time>
          ) : (
            <span className="h-[11px]" aria-hidden />
          )}
          {hasUnread ? (
            <ChatUnreadCountBadge count={unreadCount} size="sm" />
          ) : null}
        </div>
      </Link>
    </li>
  )
}

function PoolChatInboxRow({
  item,
  userId,
}: {
  item: PoolChatInboxItem
  userId: string
}) {
  const hasMessage = poolChatHasMessage(item)
  const previewText = formatPoolChatLastMessagePreview(item, userId, item.members)

  return (
    <ChatListRowShell
      href={getPoolChatHref(item.inviteCode)}
      onNavigate={() => {
        void markPoolRead(supabase, item.pool_id, userId)
        emitPoolMarkedRead(item.pool_id)
      }}
      avatar={
        <div className="relative shrink-0">
          <PoolAvatarImage
            avatar={item.poolAvatar}
            emblemUrl={item.poolEmblemUrl}
            size="sm"
            pixelSize={56}
            className="rounded-full border-border/50"
          />
          <span className="sr-only">Pool chat</span>
        </div>
      }
      title={item.pool_name}
      preview={previewText}
      previewEmpty={!hasMessage}
      timestamp={
        item.last_message_at
          ? formatChatTimestamp(item.last_message_at)
          : null
      }
      timestampIso={item.last_message_at}
      unreadCount={item.unread_count}
    />
  )
}

function DmInboxRow({
  item,
  userId,
}: {
  item: DmConversationRow
  userId: string
}) {
  const stillFriends = item.still_friends
  const name = item.other_display_name?.trim() || 'Friend'
  const hasMessage = Boolean(item.last_message?.trim())
  const previewText = formatDmLastMessagePreview(item, userId)

  return (
    <ChatListRowShell
      href={getDmChatHref(item.conversation_id)}
      onNavigate={() => {
        void markDmRead(supabase, item.conversation_id)
        emitDmMarkedRead(item.conversation_id)
      }}
      muted={!stillFriends}
      avatar={
        <div className="relative shrink-0">
          <UserAvatarImage
            avatar={item.other_avatar}
            customAvatarUrl={item.other_custom_avatar_url}
            className="h-14 w-14"
          />
          <span className="sr-only">Direct message</span>
        </div>
      }
      title={name}
      preview={previewText}
      previewEmpty={!hasMessage}
      timestamp={
        item.last_message_at
          ? formatChatTimestamp(item.last_message_at)
          : null
      }
      timestampIso={item.last_message_at}
      unreadCount={item.unread_count}
    />
  )
}

function RecentFriendsRow({
  friends,
  openingFriendId,
  onOpenFriend,
}: {
  friends: FriendRow[]
  openingFriendId: string | null
  onOpenFriend: (friend: FriendRow) => void
}) {
  if (friends.length === 0) return null

  return (
    <section aria-label="Message a friend">
      <div className="-mx-1 flex gap-5 overflow-x-auto px-1 scrollbar-none">
        {friends.map((friend) => {
          const firstName = firstNameFromDisplayName(friend.display_name)
          const isOpening = openingFriendId === friend.user_id

          return (
            <button
              key={friend.user_id}
              type="button"
              disabled={isOpening || openingFriendId != null}
              onClick={() => onOpenFriend(friend)}
              className={cn(
                'flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center transition-opacity',
                'disabled:opacity-60',
              )}
            >
              <UserAvatarImage
                avatar={friend.avatar}
                customAvatarUrl={friend.custom_avatar_url}
                className={cn(
                  'h-16 w-16 ring-2 ring-border/50',
                  isOpening && 'opacity-70',
                )}
              />
              <span className="w-full truncate text-xs font-medium text-muted-foreground">
                {firstName}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function matchesPoolSearch(item: PoolChatInboxItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (item.pool_name.toLowerCase().includes(q)) return true
  return item.members.some((member) => member.name.toLowerCase().includes(q))
}

function matchesDmSearch(item: DmConversationRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (item.other_display_name ?? '').toLowerCase().includes(q)
}

export function ChatsPageView({
  userId,
  email,
  displayName,
  avatar,
  customAvatarUrl,
}: ChatsPageViewProps) {
  const router = useRouter()
  const [poolItems, setPoolItems] = useState<PoolChatInboxItem[]>([])
  const [dmItems, setDmItems] = useState<DmConversationRow[]>([])
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [openingFriendId, setOpeningFriendId] = useState<string | null>(null)

  const loadInbox = useCallback(async () => {
    setError(null)
    const [pools, dms, friendRows] = await Promise.all([
      fetchPoolChatInbox(supabase, userId),
      fetchMyDmConversations(supabase),
      getMyFriends(supabase),
    ])
    setPoolItems(pools)
    setDmItems(dms)
    setFriends(friendRows)
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
      .channel(`chats-inbox-messages-${userId}`)
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
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

      setPoolItems((previous) =>
        previous.map((item) =>
          item.pool_id === poolId ? { ...item, unread_count: 0 } : item,
        ),
      )
    }

    function handleDmMarkedRead(event: Event) {
      const conversationId = (
        event as CustomEvent<{ conversationId: string }>
      ).detail?.conversationId
      if (!conversationId) return

      setDmItems((previous) =>
        previous.map((item) =>
          item.conversation_id === conversationId
            ? { ...item, unread_count: 0 }
            : item,
        ),
      )
    }

    window.addEventListener('focus', handleVisible)
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener(POOL_MARKED_READ_EVENT, handlePoolMarkedRead)
    window.addEventListener(DM_MARKED_READ_EVENT, handleDmMarkedRead)

    return () => {
      window.removeEventListener('focus', handleVisible)
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener(POOL_MARKED_READ_EVENT, handlePoolMarkedRead)
      window.removeEventListener(DM_MARKED_READ_EVENT, handleDmMarkedRead)
    }
  }, [loadInbox])

  const unifiedItems = useMemo(() => {
    const q = searchQuery.trim()
    const rows: UnifiedInboxItem[] = []

    for (const pool of poolItems) {
      if (!matchesPoolSearch(pool, q)) continue
      rows.push({
        kind: 'pool',
        sortAt: activityTimeMs(pool.last_message_at),
        pool,
      })
    }

    for (const dm of dmItems) {
      if (!matchesDmSearch(dm, q)) continue
      rows.push({
        kind: 'dm',
        sortAt: activityTimeMs(dm.last_message_at),
        dm,
      })
    }

    rows.sort((a, b) => b.sortAt - a.sortAt)
    return rows
  }, [dmItems, poolItems, searchQuery])

  const hasAnyConversations = poolItems.length > 0 || dmItems.length > 0

  async function handleOpenFriend(friend: FriendRow) {
    setOpeningFriendId(friend.user_id)
    const result = await getOrCreateDm(supabase, friend.user_id)
    setOpeningFriendId(null)

    if (result.notFriends) {
      toast.error('You can only message friends')
      return
    }

    if (!result.conversationId) {
      toast.error('Could not open chat')
      return
    }

    router.push(getDmChatHref(result.conversationId))
  }

  return (
    <DashboardAppShell
      userId={userId}
      email={email}
      displayName={displayName}
      avatar={avatar}
      customAvatarUrl={customAvatarUrl}
      mainClassName="py-6 sm:py-8"
    >
      <Tabs value="chat" className="gap-8">
        <DashboardDesktopNav linkDashboardTabs />

        <div className="mx-auto w-full max-w-2xl">
          <h1 className="font-display text-2xl tracking-wide text-foreground uppercase sm:text-3xl">
            Chats
          </h1>

          {loading ? (
            <ChatInboxSkeleton />
          ) : error ? (
            <p className="mt-8 text-center text-sm text-destructive">{error}</p>
          ) : (
            <div className="mt-5 flex flex-col gap-4">
              {hasAnyConversations || friends.length > 0 ? (
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search chats…"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Search chats"
                    className="h-11 rounded-full border-border/60 bg-card/90 pl-10 pr-4 shadow-none"
                  />
                </div>
              ) : null}

              <RecentFriendsRow
                friends={friends}
                openingFriendId={openingFriendId}
                onOpenFriend={(friend) => void handleOpenFriend(friend)}
              />

              {!hasAnyConversations ? (
                <div className="pt-1 text-center">
                  <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-4 text-base font-medium text-foreground">
                    No chats yet
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {friends.length > 0
                      ? 'Tap a friend above to start a message, or join a pool for group chat.'
                      : 'Add friends to message them, or join a pool for group chat.'}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href="/friends"
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
                    >
                      Find friends
                    </Link>
                    <Link
                      href="/dashboard?tab=dashboard"
                      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      View pools
                    </Link>
                  </div>
                </div>
              ) : unifiedItems.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  No chats match “{searchQuery.trim()}”.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {unifiedItems.map((item) =>
                    item.kind === 'pool' ? (
                      <PoolChatInboxRow
                        key={`pool-${item.pool.pool_id}`}
                        item={item.pool}
                        userId={userId}
                      />
                    ) : (
                      <DmInboxRow
                        key={`dm-${item.dm.conversation_id}`}
                        item={item.dm}
                        userId={userId}
                      />
                    ),
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </Tabs>
    </DashboardAppShell>
  )
}
