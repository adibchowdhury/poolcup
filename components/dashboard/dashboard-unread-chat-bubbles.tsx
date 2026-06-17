'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  emitPoolMarkedRead,
  fetchMyUnreadChats,
  getPoolChatHref,
  POOL_MARKED_READ_EVENT,
  type UnreadChatRow,
} from '@/src/lib/pool-unread-counts'
import { supabase } from '@/src/lib/supabase'

const MAX_VISIBLE_BUBBLES = 3

export function DashboardUnreadChatBubbles({ className }: { className?: string }) {
  const pathname = usePathname()
  const [unreadChats, setUnreadChats] = useState<UnreadChatRow[]>([])

  const refreshUnreadChats = useCallback(async () => {
    const rows = await fetchMyUnreadChats(supabase)
    setUnreadChats(rows)
  }, [])

  useEffect(() => {
    if (pathname !== '/dashboard') return
    void refreshUnreadChats()
  }, [pathname, refreshUnreadChats])

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === 'visible' && pathname === '/dashboard') {
        void refreshUnreadChats()
      }
    }

    window.addEventListener('focus', handleVisible)
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      window.removeEventListener('focus', handleVisible)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [pathname, refreshUnreadChats])

  useEffect(() => {
    function handlePoolMarkedRead() {
      void refreshUnreadChats()
    }

    window.addEventListener(POOL_MARKED_READ_EVENT, handlePoolMarkedRead)
    return () => {
      window.removeEventListener(POOL_MARKED_READ_EVENT, handlePoolMarkedRead)
    }
  }, [refreshUnreadChats])

  if (unreadChats.length === 0) {
    return null
  }

  const visibleChats = unreadChats.slice(0, MAX_VISIBLE_BUBBLES)
  const overflowCount = unreadChats.length - visibleChats.length

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1.5 overflow-x-auto',
        className,
      )}
    >
      {visibleChats.map((chat) => (
        <Link
          key={chat.pool_id}
          href={getPoolChatHref(chat.invite_code)}
          onClick={() => emitPoolMarkedRead(chat.pool_id)}
          aria-label={`${chat.unread_count} unread messages in ${chat.pool_name}, open chat`}
          className="inline-flex min-h-10 max-w-[8.5rem] shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground sm:max-w-[11rem] sm:text-sm"
        >
          <span className="truncate font-medium text-foreground">
            {chat.pool_name}
          </span>
          <span className="shrink-0">💬 {chat.unread_count}</span>
        </Link>
      ))}
      {overflowCount > 0 ? (
        <span className="inline-flex min-h-10 shrink-0 items-center px-1 text-xs text-muted-foreground sm:text-sm">
          +{overflowCount} more
        </span>
      ) : null}
    </div>
  )
}
