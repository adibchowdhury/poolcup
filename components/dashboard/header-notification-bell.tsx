'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  Flame,
  Loader2,
  Medal,
  MessageSquare,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { NavIconWithCountBadge } from '@/components/nav-icon-with-count-badge'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  notificationHref,
  relativeNotificationTime,
  type NotificationRow,
} from '@/src/lib/notifications'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/src/lib/notifications-client'
import { capturePostHog } from '@/src/lib/posthog-client'

function categoryIcon(category: string) {
  switch (category) {
    case 'pool_invite':
      return Users
    case 'friend':
      return UserPlus
    case 'badge':
      return Medal
    case 'level':
      return Zap
    case 'prediction_scored':
      return Trophy
    case 'leaderboard':
      return Flame
    case 'announcement':
      return MessageSquare
    case 'match_reminder':
      return Bell
    default:
      return Sparkles
  }
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.tabIndex !== -1)
}

export function HeaderNotificationBell({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const refreshCount = useCallback(async () => {
    const count = await fetchUnreadNotificationCount()
    setUnread(count)
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchNotifications({ limit: 30, offset: 0 })
    if (result.error) {
      setError(result.error)
      setItems([])
    } else {
      setItems(result.items)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshCount()
  }, [refreshCount, pathname])

  useEffect(() => {
    if (!open) return
    void (async () => {
      const count = await fetchUnreadNotificationCount()
      setUnread(count)
      capturePostHog('notification_bell_opened', { unread_count: count })
    })()
    void loadList()
  }, [open, loadList])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (!panelRef.current) return
      const nodes = focusableIn(panelRef.current)
      if (nodes.length === 0) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const active = document.activeElement as HTMLElement | null
        const idx = active ? nodes.indexOf(active) : -1
        const next =
          event.key === 'ArrowDown'
            ? nodes[(idx + 1 + nodes.length) % nodes.length]!
            : nodes[(idx - 1 + nodes.length) % nodes.length]!
        next.focus()
        return
      }

      if (event.key !== 'Tab') return
      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function handleItemActivate(item: NotificationRow) {
    if (!item.read_at) {
      await markNotificationRead(item.id)
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, read_at: new Date().toISOString() }
            : row,
        ),
      )
      setUnread((n) => Math.max(0, n - 1))
    }
    capturePostHog('notification_clicked', { category: item.category })
    const href = notificationHref(item.data)
    setOpen(false)
    if (href) router.push(href)
  }

  async function handleMarkAll() {
    setMarkingAll(true)
    const ok = await markAllNotificationsRead()
    setMarkingAll(false)
    if (!ok) return
    capturePostHog('notification_mark_all_read', {})
    setItems((prev) =>
      prev.map((row) => ({
        ...row,
        read_at: row.read_at ?? new Date().toISOString(),
      })),
    )
    setUnread(0)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg',
            'text-foreground transition-colors hover:bg-muted/50',
            FOCUS_VISIBLE_RING,
            className,
          )}
          aria-label={
            unread > 0
              ? `Notifications, ${unread} unread`
              : 'Notifications'
          }
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <NavIconWithCountBadge
            icon={Bell}
            count={unread}
            badgeLabel={`${unread} unread notifications`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-1.5rem,22rem)] border-border bg-card p-0 shadow-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          panelRef.current
            ?.querySelector<HTMLElement>('[data-notif-autofocus]')
            ?.focus()
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex max-h-[min(70vh,28rem)] flex-col"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <h2
              id={titleId}
              className="font-display text-lg tracking-wide text-foreground"
            >
              Notifications
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-notif-autofocus
              className={cn('h-8 px-2 text-xs', FOCUS_VISIBLE_RING)}
              disabled={markingAll || unread === 0}
              onClick={() => void handleMarkAll()}
            >
              {markingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                'Mark all read'
              )}
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="space-y-2 p-3">
                <ShimmerBlock className="h-14 w-full rounded-lg" />
                <ShimmerBlock className="h-14 w-full rounded-lg" />
                <ShimmerBlock className="h-14 w-full rounded-lg" />
              </div>
            ) : error && items.length === 0 ? (
              <div className="space-y-2 px-3 py-8 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={FOCUS_VISIBLE_RING}
                  onClick={() => void loadList()}
                >
                  Try again
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <Bell
                  className="mx-auto h-8 w-8 text-muted-foreground/50"
                  aria-hidden
                />
                <p className="mt-3 text-sm font-medium text-foreground">
                  You&apos;re all caught up
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pool invites, friends, badges, and scores land here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/80" role="list">
                {items.map((item) => {
                  const Icon = categoryIcon(item.category)
                  const unreadItem = !item.read_at
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                          FOCUS_VISIBLE_RING,
                          unreadItem && 'bg-primary/[0.04]',
                        )}
                        onClick={() => void handleItemActivate(item)}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background',
                            unreadItem && 'border-primary/30 text-primary',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {item.title}
                            </span>
                            {unreadItem ? (
                              <span
                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                                aria-label="Unread"
                              />
                            ) : null}
                          </span>
                          {item.body ? (
                            <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {item.body}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {relativeNotificationTime(item.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-3 py-2">
            <Link
              href="/settings/notifications"
              className={cn(
                'block rounded-md px-1 py-1.5 text-center text-xs font-medium text-primary hover:underline',
                FOCUS_VISIBLE_RING,
              )}
              onClick={() => setOpen(false)}
            >
              Notification settings
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
