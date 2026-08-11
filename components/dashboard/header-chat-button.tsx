'use client'

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { ChatNavIconWithBadge } from '@/components/chat/chat-nav-icon-with-badge'
import { useUnreadChatCount } from '@/hooks/use-unread-chat-count'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { CHAT_INBOX_HREF } from '@/src/lib/mobile-bottom-nav-routes'

/**
 * Top-bar chat control — sits beside notifications.
 * Unread badge uses get_unread_chat_count + DM unread (via useUnreadChatCount).
 */
export function HeaderChatButton({ className }: { className?: string }) {
  const unreadChatCount = useUnreadChatCount()
  const label =
    unreadChatCount > 0
      ? `Chat, ${unreadChatCount} unread`
      : 'Chat'

  return (
    <Link
      href={CHAT_INBOX_HREF}
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
        'text-foreground transition-colors hover:bg-muted/50',
        FOCUS_VISIBLE_RING,
        className,
      )}
      aria-label={label}
    >
      <ChatNavIconWithBadge
        icon={MessageCircle}
        count={unreadChatCount}
        iconClassName="h-5 w-5"
      />
    </Link>
  )
}
