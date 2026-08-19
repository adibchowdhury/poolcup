'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { HeaderNotificationBell } from '@/components/dashboard/header-notification-bell'
import { HubHelpMenu } from '@/components/dashboard/hub-help-menu'
import { ReportIssueButton } from '@/components/report-issue-dialog'
import { HUB_DESKTOP_CONTENT_GUTTER_CLASS } from '@/components/dashboard/hub-desktop-nav-frame'
import { resolveHubContentHeader } from '@/src/lib/hub-content-title'
import { cn } from '@/lib/utils'

type HubDesktopContentTopBarProps = {
  /** Optional override (e.g. pool name when a page supplies context). */
  title?: string
  /** Sticky header surface — matches dashboard canvas on /dashboard. */
  chromeSurfaceClass?: string
}

export function HubDesktopContentTopBar({
  title,
  chromeSurfaceClass = 'bg-[#0A0E0E]/95',
}: HubDesktopContentTopBarProps) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const header = resolveHubContentHeader(pathname, searchParams.get('tab'))
  const resolvedTitle = title ?? header.title
  const Icon = header.icon

  return (
    <header
      className={cn(
        'sticky top-0 z-30 hidden shrink-0 border-b border-white/[0.08] backdrop-blur-xl lg:block',
        chromeSurfaceClass,
      )}
      aria-label="Page header"
    >
      <div
        className={cn(
          'flex h-14 w-full items-center justify-between gap-4',
          HUB_DESKTOP_CONTENT_GUTTER_CLASS,
        )}
      >
        <h1 className="flex min-w-0 items-center gap-2.5 font-display text-2xl tracking-wide text-foreground">
          <Icon
            className="h-6 w-6 shrink-0 text-primary"
            aria-hidden
          />
          <span className="truncate">{resolvedTitle}</span>
        </h1>
        <div className="flex shrink-0 items-center gap-0.5">
          <HeaderNotificationBell />
          <ReportIssueButton className="hidden lg:inline-flex" />
          <HubHelpMenu />
        </div>
      </div>
    </header>
  )
}
