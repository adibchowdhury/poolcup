import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { ChatUnreadCountBadge } from '@/components/chat/chat-unread-count-badge'

type ChatNavIconWithBadgeProps = {
  icon: LucideIcon
  count: number
  iconClassName?: string
  /** Footer nav: keep badge inward so it is not clipped on the right edge. */
  variant?: 'default' | 'footer'
}

export function ChatNavIconWithBadge({
  icon: Icon,
  count,
  iconClassName = 'h-5 w-5',
  variant = 'default',
}: ChatNavIconWithBadgeProps) {
  return (
    <span className="relative inline-flex shrink-0 overflow-visible">
      <Icon className={cn('shrink-0', iconClassName)} aria-hidden />
      <span
        className={cn(
          'pointer-events-none absolute z-10',
          variant === 'footer'
            ? 'top-0 left-1/2 -translate-y-1/2 translate-x-1'
            : '-right-1.5 -top-1.5',
        )}
      >
        <ChatUnreadCountBadge count={count} size="sm" />
      </span>
    </span>
  )
}
