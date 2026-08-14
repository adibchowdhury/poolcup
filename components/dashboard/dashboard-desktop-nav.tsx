'use client'

import Link from 'next/link'
import { Calendar, Compass, Home, User, Users } from 'lucide-react'
import { NavIconWithCountBadge } from '@/components/nav-icon-with-count-badge'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFriendRequestCount } from '@/hooks/use-friend-request-count'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_TAB_HREFS,
  DISCOVER_HREF,
  FRIENDS_HREF,
} from '@/src/lib/mobile-bottom-nav-routes'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

const triggerClassName = cn(
  'gap-1.5 rounded-full px-2 py-2 text-[11px] sm:px-2.5 sm:text-sm',
  FOCUS_VISIBLE_RING,
)

type DashboardDesktopNavProps = {
  /** When true, dashboard sections link to /dashboard tabs (for /chat and other hub routes). */
  linkDashboardTabs?: boolean
}

function DashboardNavTrigger({
  value,
  href,
  linkDashboardTabs,
  className,
  children,
}: {
  value: string
  href?: string
  linkDashboardTabs: boolean
  className?: string
  children: React.ReactNode
}) {
  const merged = cn(triggerClassName, className)

  if (linkDashboardTabs && href) {
    return (
      <TabsTrigger value={value} asChild className={merged}>
        <Link href={href}>{children}</Link>
      </TabsTrigger>
    )
  }

  return (
    <TabsTrigger value={value} className={merged}>
      {children}
    </TabsTrigger>
  )
}

export function DashboardDesktopNav({
  linkDashboardTabs = false,
}: DashboardDesktopNavProps) {
  const { count: friendRequestCount } = useFriendRequestCount()

  return (
    <TabsList className="mx-auto hidden h-auto w-full max-w-4xl grid-cols-3 gap-1 rounded-full border border-white/[0.08] bg-[#0A0E0E]/90 p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)] sm:grid sm:grid-cols-5">
      <DashboardNavTrigger
        value="games"
        href={DASHBOARD_TAB_HREFS.upcoming}
        linkDashboardTabs={linkDashboardTabs}
      >
        <Calendar className="h-4 w-4 shrink-0" />
        <span className="truncate">Matches</span>
      </DashboardNavTrigger>

      <TabsTrigger value="friends" asChild className={triggerClassName}>
        <Link href={FRIENDS_HREF}>
          <NavIconWithCountBadge
            icon={Users}
            count={friendRequestCount}
            iconClassName="h-4 w-4"
            badgeLabel={`${friendRequestCount} friend requests`}
          />
          <span className="truncate">Friends</span>
        </Link>
      </TabsTrigger>

      <DashboardNavTrigger
        value="dashboard"
        href={DASHBOARD_TAB_HREFS.dashboard}
        linkDashboardTabs={linkDashboardTabs}
        className={cn(
          'data-[state=active]:bg-primary data-[state=active]:text-[#0A0E0E]',
          'data-[state=active]:shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_28%,transparent)]',
        )}
      >
        <Home className="h-4 w-4 shrink-0" />
        <span className="truncate">Home</span>
      </DashboardNavTrigger>

      <TabsTrigger value="discover" asChild className={triggerClassName}>
        <Link href={DISCOVER_HREF}>
          <Compass className="h-4 w-4 shrink-0" />
          <span className="truncate">Discover</span>
        </Link>
      </TabsTrigger>

      <DashboardNavTrigger
        value="profile"
        href={DASHBOARD_TAB_HREFS.profile}
        linkDashboardTabs={linkDashboardTabs}
      >
        <User className="h-4 w-4 shrink-0" />
        <span className="truncate">Profile</span>
      </DashboardNavTrigger>
    </TabsList>
  )
}
