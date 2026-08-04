'use client'

import Link from 'next/link'
import { Calendar, Home, MessageCircle, User, Users } from 'lucide-react'
import { ChatNavIconWithBadge } from '@/components/chat/chat-nav-icon-with-badge'
import { NavIconWithCountBadge } from '@/components/nav-icon-with-count-badge'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFriendRequestCount } from '@/hooks/use-friend-request-count'
import { useUnreadChatCount } from '@/hooks/use-unread-chat-count'
import { cn } from '@/lib/utils'
import {
  CHAT_INBOX_HREF,
  DASHBOARD_TAB_HREFS,
  FRIENDS_HREF,
} from '@/src/lib/mobile-bottom-nav-routes'

const triggerClassName =
  'gap-1.5 rounded-full px-2 py-2 text-[11px] sm:px-2.5 sm:text-sm'

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
  const unreadChatCount = useUnreadChatCount()
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
          'data-[state=active]:shadow-[0_6px_18px_rgba(0,230,118,0.28)]',
        )}
      >
        <Home className="h-4 w-4 shrink-0" />
        <span className="truncate">Dashboard</span>
      </DashboardNavTrigger>

      <TabsTrigger value="chat" asChild className={triggerClassName}>
        <Link href={CHAT_INBOX_HREF}>
          <ChatNavIconWithBadge
            icon={MessageCircle}
            count={unreadChatCount}
            iconClassName="h-4 w-4"
          />
          <span className="truncate">Chat</span>
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
