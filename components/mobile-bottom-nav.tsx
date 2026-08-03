'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Calendar,
  MessageCircle,
  Trophy,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatNavIconWithBadge } from '@/components/chat/chat-nav-icon-with-badge'
import { NavIconWithCountBadge } from '@/components/nav-icon-with-count-badge'
import { useUnreadChatCount } from '@/hooks/use-unread-chat-count'
import { useFriendRequestCount } from '@/hooks/use-friend-request-count'
import {
  hasAuthenticatedBottomBar,
  isAuthenticatedAppPath,
} from '@/src/lib/authenticated-paths'
import { useMobileInputFocused } from '@/hooks/use-mobile-input-focused'
import { useDashboardTab } from '@/src/lib/dashboard-tab-context'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import {
  CHAT_INBOX_HREF,
  DASHBOARD_TAB_HREFS,
  isDashboardBottomNavId,
  type MobileBottomNavId,
  resolveMobileBottomNavActive,
} from '@/src/lib/mobile-bottom-nav-routes'

const NAV_ITEMS: {
  id: MobileBottomNavId
  label: string
  href: string
  icon: typeof User
}[] = [
  {
    id: 'upcoming',
    label: 'Matches',
    href: DASHBOARD_TAB_HREFS.upcoming,
    icon: Calendar,
  },
  { id: 'pools', label: 'Pools', href: DASHBOARD_TAB_HREFS.pools, icon: Trophy },
  { id: 'chat', label: 'Chat', href: CHAT_INBOX_HREF, icon: MessageCircle },
  { id: 'profile', label: 'Profile', href: DASHBOARD_TAB_HREFS.profile, icon: User },
]

const navItemClassName = (isActive: boolean) =>
  cn(
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-px overflow-visible px-0.5 py-0.5 text-[10px] font-medium transition-colors',
    isActive
      ? 'text-primary'
      : 'text-muted-foreground hover:text-foreground',
  )

function NavItemContent({
  item,
}: {
  item: (typeof NAV_ITEMS)[number]
}) {
  const Icon = item.icon
  const unreadChatCount = useUnreadChatCount()
  const { count: friendRequestCount } = useFriendRequestCount()

  if (item.id === 'chat') {
    return (
      <>
        <ChatNavIconWithBadge
          icon={MessageCircle}
          count={unreadChatCount}
          variant="footer"
          iconClassName="h-6 w-6"
        />
        <span className="max-w-full truncate">{item.label}</span>
      </>
    )
  }

  if (item.id === 'profile') {
    return (
      <>
        <NavIconWithCountBadge
          icon={User}
          count={friendRequestCount}
          variant="footer"
          iconClassName="h-6 w-6"
          badgeLabel={`${friendRequestCount} friend requests`}
        />
        <span className="max-w-full truncate">{item.label}</span>
      </>
    )
  }

  return (
    <>
      <Icon className="h-6 w-6 shrink-0" aria-hidden />
      <span className="max-w-full truncate">{item.label}</span>
    </>
  )
}

function MobileBottomNavContent() {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const { mobileChatActive } = useMobileChatChrome()
  const inputFocused = useMobileInputFocused()
  const { activeNavId, switchDashboardTab } = useDashboardTab()

  const tabParam = searchParams.get('tab')
  const isOnDashboard = pathname === '/dashboard'
  const routeActiveId = resolveMobileBottomNavActive(pathname, tabParam)
  const activeId =
    isOnDashboard && activeNavId != null ? activeNavId : routeActiveId
  const onPredictPage = hasAuthenticatedBottomBar(pathname)
  const visible =
    isAuthenticatedAppPath(pathname) &&
    !mobileChatActive &&
    !onPredictPage &&
    !inputFocused

  if (!visible) {
    return null
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 overflow-visible border-t border-border/80 bg-background/95 backdrop-blur-md pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:hidden"
      aria-label="Main navigation"
    >
      <div className="flex h-12 w-full items-stretch overflow-visible px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id

          if (isOnDashboard && isDashboardBottomNavId(item.id)) {
            const dashboardTabId = item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchDashboardTab(dashboardTabId)}
                className={navItemClassName(isActive)}
                aria-current={isActive ? 'page' : undefined}
              >
                <NavItemContent item={item} />
              </button>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={navItemClassName(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              <NavItemContent item={item} />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function MobileBottomNav() {
  return (
    <Suspense fallback={null}>
      <MobileBottomNavContent />
    </Suspense>
  )
}
