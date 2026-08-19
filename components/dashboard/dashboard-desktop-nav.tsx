'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { MouseEvent } from 'react'
import { Calendar, Compass, Home, User, Users } from 'lucide-react'
import { NavIconWithCountBadge } from '@/components/nav-icon-with-count-badge'
import { useFriendRequestCount } from '@/hooks/use-friend-request-count'
import { cn } from '@/lib/utils'
import { usePrefetchHubRoutes } from '@/src/lib/hub-nav-prefetch'
import { useDashboardTab } from '@/src/lib/dashboard-tab-context'
import {
  DASHBOARD_TAB_HREFS,
  DISCOVER_HREF,
  FRIENDS_HREF,
  resolveHubDesktopNavValue,
  type DashboardBottomNavId,
} from '@/src/lib/mobile-bottom-nav-routes'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

const itemClassName = cn(
  'inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent px-2 py-2 text-[11px] font-medium sm:px-2.5 sm:text-sm',
  FOCUS_VISIBLE_RING,
)

const itemActiveClassName =
  'bg-background text-foreground shadow-sm dark:bg-input/30 dark:text-foreground'

type DashboardDesktopNavProps = {
  /** @deprecated Active state is derived from the pathname. Kept for callers. */
  linkDashboardTabs?: boolean
}

export function DashboardDesktopNav({
  linkDashboardTabs: _linkDashboardTabs = true,
}: DashboardDesktopNavProps) {
  const { count: friendRequestCount } = useFriendRequestCount()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const { switchDashboardTab } = useDashboardTab()
  const isOnDashboard = pathname === '/dashboard'
  const activeNav = resolveHubDesktopNavValue(pathname, searchParams.get('tab'))
  usePrefetchHubRoutes()

  function onDashboardTabClick(
    event: MouseEvent<HTMLAnchorElement>,
    navId: DashboardBottomNavId,
  ) {
    if (!isOnDashboard) return
    event.preventDefault()
    switchDashboardTab(navId)
  }

  return (
    <nav
      aria-label="Main"
      className="mx-auto hidden h-auto w-full max-w-4xl grid-cols-3 gap-1 rounded-full border border-white/[0.08] bg-[#0A0E0E]/90 p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)] sm:grid sm:grid-cols-5"
    >
      <Link
        href={DASHBOARD_TAB_HREFS.upcoming}
        prefetch
        replace={isOnDashboard}
        aria-current={activeNav === 'games' ? 'page' : undefined}
        className={cn(
          itemClassName,
          activeNav === 'games' && itemActiveClassName,
        )}
        onClick={(event) => onDashboardTabClick(event, 'upcoming')}
      >
        <Calendar className="h-4 w-4 shrink-0" />
        <span className="truncate">Matches</span>
      </Link>

      <Link
        href={FRIENDS_HREF}
        prefetch
        aria-current={activeNav === 'friends' ? 'page' : undefined}
        className={cn(
          itemClassName,
          activeNav === 'friends' && itemActiveClassName,
        )}
      >
        <NavIconWithCountBadge
          icon={Users}
          count={friendRequestCount}
          iconClassName="h-4 w-4"
          badgeLabel={`${friendRequestCount} friend requests`}
        />
        <span className="truncate">Friends</span>
      </Link>

      <Link
        href={DASHBOARD_TAB_HREFS.dashboard}
        prefetch
        replace={isOnDashboard}
        aria-current={activeNav === 'dashboard' ? 'page' : undefined}
        className={cn(
          itemClassName,
          activeNav === 'dashboard' &&
            'bg-primary text-[#0A0E0E] shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_28%,transparent)]',
        )}
        onClick={(event) => onDashboardTabClick(event, 'dashboard')}
      >
        <Home className="h-4 w-4 shrink-0" />
        <span className="truncate">Home</span>
      </Link>

      <Link
        href={DISCOVER_HREF}
        prefetch
        aria-current={activeNav === 'discover' ? 'page' : undefined}
        className={cn(
          itemClassName,
          activeNav === 'discover' && itemActiveClassName,
        )}
      >
        <Compass className="h-4 w-4 shrink-0" />
        <span className="truncate">Discover</span>
      </Link>

      <Link
        href={DASHBOARD_TAB_HREFS.profile}
        prefetch
        replace={isOnDashboard}
        aria-current={activeNav === 'profile' ? 'page' : undefined}
        className={cn(
          itemClassName,
          activeNav === 'profile' && itemActiveClassName,
        )}
        onClick={(event) => onDashboardTabClick(event, 'profile')}
      >
        <User className="h-4 w-4 shrink-0" />
        <span className="truncate">Profile</span>
      </Link>
    </nav>
  )
}
