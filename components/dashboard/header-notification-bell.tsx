'use client'

import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Header notification bell — visual only for now (no dropdown / nav).
 */
export function HeaderNotificationBell({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg',
        'text-foreground transition-colors hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5" aria-hidden />
    </button>
  )
}
