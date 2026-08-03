import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type NavIconWithCountBadgeProps = {
  icon: LucideIcon
  count: number
  iconClassName?: string
  /** Footer nav: keep badge inward so it is not clipped on the right edge. */
  variant?: 'default' | 'footer'
  /** Accessible label when count > 0. */
  badgeLabel?: string
}

/**
 * Icon + numeric badge (friend requests, etc.). Same geometry as chat unread.
 */
export function NavIconWithCountBadge({
  icon: Icon,
  count,
  iconClassName = 'h-5 w-5',
  variant = 'default',
  badgeLabel,
}: NavIconWithCountBadgeProps) {
  const show = count > 0
  const display = count > 9 ? '9+' : String(count)

  return (
    <span className="relative inline-flex shrink-0 overflow-visible">
      <Icon className={cn('shrink-0', iconClassName)} aria-hidden />
      {show ? (
        <span
          className={cn(
            'pointer-events-none absolute z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground shadow-[0_0_0_2px_hsl(var(--background))]',
            variant === 'footer'
              ? 'top-0 left-1/2 -translate-y-1/2 translate-x-1'
              : '-right-1.5 -top-1.5',
          )}
          aria-label={badgeLabel ?? `${count} notifications`}
        >
          {display}
        </span>
      ) : null}
    </span>
  )
}
