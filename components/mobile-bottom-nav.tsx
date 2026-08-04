'use client'

import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Calendar,
  Home,
  MessageCircle,
  User,
  Users,
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
  FRIENDS_HREF,
  isDashboardBottomNavId,
  type MobileBottomNavId,
  resolveMobileBottomNavActive,
} from '@/src/lib/mobile-bottom-nav-routes'

const NAV_ITEMS: {
  id: MobileBottomNavId
  label: string
  href: string
  icon: typeof User
  homeAnchor?: boolean
}[] = [
  {
    id: 'upcoming',
    label: 'Matches',
    href: DASHBOARD_TAB_HREFS.upcoming,
    icon: Calendar,
  },
  {
    id: 'friends',
    label: 'Friends',
    href: FRIENDS_HREF,
    icon: Users,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: DASHBOARD_TAB_HREFS.dashboard,
    icon: Home,
    homeAnchor: true,
  },
  { id: 'chat', label: 'Chat', href: CHAT_INBOX_HREF, icon: MessageCircle },
  {
    id: 'profile',
    label: 'Profile',
    href: DASHBOARD_TAB_HREFS.profile,
    icon: User,
  },
]

function SideTabIcon({
  item,
  isActive,
}: {
  item: (typeof NAV_ITEMS)[number]
  isActive: boolean
}) {
  const Icon = item.icon
  const unreadChatCount = useUnreadChatCount()
  const { count: friendRequestCount } = useFriendRequestCount()
  const iconClass = cn(
    'h-[22px] w-[22px]',
    isActive ? 'text-primary' : 'text-muted-foreground',
  )

  if (item.id === 'chat') {
    return (
      <ChatNavIconWithBadge
        icon={MessageCircle}
        count={unreadChatCount}
        variant="footer"
        iconClassName={iconClass}
      />
    )
  }

  if (item.id === 'friends') {
    return (
      <NavIconWithCountBadge
        icon={Users}
        count={friendRequestCount}
        variant="footer"
        iconClassName={iconClass}
        badgeLabel={`${friendRequestCount} friend requests`}
      />
    )
  }

  return <Icon className={cn('shrink-0', iconClass)} aria-hidden />
}

function SideTabLabel({
  label,
  isActive,
}: {
  label: string
  isActive: boolean
}) {
  return (
    <span
      className={cn(
        'max-w-full truncate text-[9px] font-medium leading-none tracking-wide transition-opacity',
        isActive ? 'text-primary opacity-100' : 'text-muted-foreground/70 opacity-80',
      )}
    >
      {label}
    </span>
  )
}

function HomeAnchorButton({
  isActive,
  children,
}: {
  isActive: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'relative -top-3.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white',
        'shadow-[0_10px_28px_rgba(0,0,0,0.55),0_0_22px_rgba(0,230,118,0.28)]',
        isActive && 'scale-[1.02]',
      )}
    >
      {children}
    </span>
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 overflow-visible sm:hidden"
      aria-label="Main navigation"
    >
      <div
        className={cn(
          'pointer-events-auto relative flex h-[calc(3.6rem+env(safe-area-inset-bottom,0px))] w-full items-center justify-between gap-0.5',
          'rounded-t-3xl border-t border-white/[0.08] bg-[#0A0E0E] px-2.5',
          'pb-[env(safe-area-inset-bottom,0px)]',
          'shadow-[0_-8px_32px_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.06)_inset]',
        )}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id
          const isHome = Boolean(item.homeAnchor)

          const sideClassName = cn(
            'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 transition-colors',
            isActive
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )

          const homeClassName =
            'relative flex flex-1 items-center justify-center overflow-visible'

          if (isHome) {
            const homeInner = (
              <HomeAnchorButton isActive={isActive}>
                <Home className="h-6 w-6 text-white" strokeWidth={2.25} aria-hidden />
              </HomeAnchorButton>
            )

            if (isOnDashboard && isDashboardBottomNavId(item.id)) {
              const dashboardTabId = item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchDashboardTab(dashboardTabId)}
                  className={homeClassName}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {homeInner}
                </button>
              )
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className={homeClassName}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {homeInner}
              </Link>
            )
          }

          const sideInner = (
            <>
              <SideTabIcon item={item} isActive={isActive} />
              <SideTabLabel label={item.label} isActive={isActive} />
            </>
          )

          if (isOnDashboard && isDashboardBottomNavId(item.id)) {
            const dashboardTabId = item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchDashboardTab(dashboardTabId)}
                className={sideClassName}
                aria-current={isActive ? 'page' : undefined}
              >
                {sideInner}
              </button>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={sideClassName}
              aria-current={isActive ? 'page' : undefined}
            >
              {sideInner}
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
