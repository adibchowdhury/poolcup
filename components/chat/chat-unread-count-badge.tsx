import { cn } from '@/lib/utils'

type ChatUnreadCountBadgeProps = {
  count: number
  className?: string
  size?: 'default' | 'sm'
}

const SIZE_CLASSES = {
  default: 'min-h-5 min-w-5 px-1.5 text-[11px]',
  sm: 'min-h-4 min-w-4 px-1 text-[9px] leading-none',
} as const

export function ChatUnreadCountBadge({
  count,
  className,
  size = 'default',
}: ChatUnreadCountBadgeProps) {
  if (count <= 0) {
    return null
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary font-semibold tabular-nums text-primary-foreground',
        SIZE_CLASSES[size],
        className,
      )}
      aria-label={`${count} unread messages`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
