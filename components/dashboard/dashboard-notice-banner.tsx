'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const DASHBOARD_NOTICE_BANNER_CLASS =
  'rounded-lg border border-primary/30 border-l-4 border-l-primary bg-[#0d1f14] px-4 py-3 text-sm leading-relaxed sm:px-5 sm:py-3.5 sm:text-base'

type DashboardNoticeBannerProps = {
  children: React.ReactNode
  role?: 'status' | 'alert'
  className?: string
  dismissible?: boolean
  onDismiss?: () => void
  dismissAriaLabel?: string
}

export function DashboardNoticeBanner({
  children,
  role = 'status',
  className,
  dismissible = false,
  onDismiss,
  dismissAriaLabel = 'Dismiss notice',
}: DashboardNoticeBannerProps) {
  return (
    <div
      className={cn(
        DASHBOARD_NOTICE_BANNER_CLASS,
        dismissible && 'relative pr-12',
        className,
      )}
      role={role}
    >
      {children}
      {dismissible ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          onClick={onDismiss}
          aria-label={dismissAriaLabel}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )
}
