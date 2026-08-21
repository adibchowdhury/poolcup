'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { MessageCircle, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { ChatInboxSkeleton } from '@/components/chat/chat-inbox-skeleton'
import { ChatUnreadCountBadge } from '@/components/chat/chat-unread-count-badge'
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
  getPoolChatDesktopHref,
  getPoolChatHref,
  markPoolRead,
  POOL_MARKED_READ_EVENT,
} from '@/src/lib/pool-unread-counts'
import { getMyFriends, type FriendRow } from '@/src/lib/friendships'
import { supabase } from '@/src/lib/supabase'
type ChatsPageViewProps = {
  userId: string
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
  selected = false,
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
  selected?: boolean
}) {
  const hasUnread = unreadCount > 0

  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={selected ? 'page' : undefined}
        className={cn(
          'flex items-center gap-4 px-1 py-3 transition-colors sm:px-1.5',
          'hover:bg-muted/30 active:bg-muted/45',
          selected && 'bg-primary/12 hover:bg-primary/15',
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
  selected = false,
  desktopHref = false,
}: {
  item: PoolChatInboxItem
  userId: string
  selected?: boolean
  /** Desktop inbox: open in /chat/pool/... two-pane route. */
  desktopHref?: boolean
}) {
  const hasMessage = poolChatHasMessage(item)
  const previewText = formatPoolChatLastMessagePreview(item, userId, item.members)

  return (
    <ChatListRowShell
      href={
        desktopHref
          ? getPoolChatDesktopHref(item.inviteCode)
          : getPoolChatHref(item.inviteCode)
      }
      onNavigate={() => {
        void markPoolRead(supabase, item.pool_id, userId)
        emitPoolMarkedRead(item.pool_id)
      }}
      selected={selected}
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
  selected = false,
}: {
  item: DmConversationRow
  userId: string
  selected?: boolean
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
      selected={selected}
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

/** Matches Tailwind `lg:` — mount only one chat chrome tree per breakpoint. */
const LG_UP_MQ = '(min-width: 1024px)'

function subscribeLgUp(onChange: () => void) {
  const mql = window.matchMedia(LG_UP_MQ)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getLgUpSnapshot() {
  return window.matchMedia(LG_UP_MQ).matches
}

function getLgUpServerSnapshot() {
  return false
}

export function useIsChatDesktopLayout() {
  return useSyncExternalStore(
    subscribeLgUp,
    getLgUpSnapshot,
    getLgUpServerSnapshot,
  )
}

export function ChatInboxPanel({
  userId,
  selectedConversationId = null,
  selectedPoolInviteCode = null,
  desktopPoolLinks = false,
  className,
}: {
  userId: string
  selectedConversationId?: string | null
  selectedPoolInviteCode?: string | null
  /** When true (desktop shell inbox), pool rows link to /chat/pool/... */
  desktopPoolLinks?: boolean
  className?: string
}) {
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
    setFriends(friendRows.friends)
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

  if (loading) {
    return (
      <div className={className}>
        <ChatInboxSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <p className={cn('mt-8 text-center text-sm text-destructive', className)}>
        {error}
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {hasAnyConversations || friends.length > 0 ? (
        <div className="relative shrink-0">
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
                desktopHref={desktopPoolLinks}
                selected={
                  selectedPoolInviteCode != null &&
                  item.pool.inviteCode === selectedPoolInviteCode
                }
              />
            ) : (
              <DmInboxRow
                key={`dm-${item.dm.conversation_id}`}
                item={item.dm}
                userId={userId}
                selected={
                  selectedConversationId != null &&
                  item.dm.conversation_id === selectedConversationId
                }
              />
            ),
          )}
        </ul>
      )}
    </div>
  )
}

export function ChatEmptyConversationPane({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mascot/onboarding_mascot/pucky_2.webp"
        alt=""
        className="h-20 w-20 object-contain opacity-80"
      />
      <p className="text-base font-medium text-foreground">
        Select a conversation
      </p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Choose a chat from the list to start messaging.
      </p>
    </div>
  )
}

/** Desktop (lg+) two-pane frame: inbox left, conversation right. */
export function ChatDesktopTwoPane({
  userId,
  selectedConversationId = null,
  selectedPoolInviteCode = null,
  children,
}: {
  userId: string
  selectedConversationId?: string | null
  selectedPoolInviteCode?: string | null
  children: ReactNode
}) {
  // Match hub top bar chrome base (#0A0E0E) — top bar uses bg-[#0A0E0E]/95 + blur.
  // Height = viewport minus sticky top bar (h-14); main gutters cleared by page shell.
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden bg-[#0A0E0E]">
      <aside
        className={cn(
          'flex w-[22.5rem] shrink-0 flex-col border-r border-border/80 bg-[#0A0E0E]',
          'min-[1280px]:w-[23.75rem]',
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-3">
          <ChatInboxPanel
            userId={userId}
            selectedConversationId={selectedConversationId}
            selectedPoolInviteCode={selectedPoolInviteCode}
            desktopPoolLinks
          />
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#0A0E0E]">
        {children}
      </section>
    </div>
  )
}

export function ChatsPageView({ userId }: ChatsPageViewProps) {
  const isDesktop = useIsChatDesktopLayout()

  // Desktop: inbox lives in ChatAppShell left pane; this route only fills the right pane.
  if (isDesktop) {
    return <ChatEmptyConversationPane />
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="font-display text-2xl tracking-wide text-foreground uppercase sm:text-3xl">
        Chats
      </h1>
      <div className="mt-5">
        <ChatInboxPanel userId={userId} />
      </div>
    </div>
  )
}
