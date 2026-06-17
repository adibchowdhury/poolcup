type ChatUnreadCountBadgeProps = {
  count: number
  className?: string
}

export function ChatUnreadCountBadge({ count, className }: ChatUnreadCountBadgeProps) {
  if (count <= 0) {
    return null
  }

  return (
    <span
      className={
        className ??
        'inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground'
      }
      aria-label={`${count} unread messages`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
