'use client'

import Link from 'next/link'
import { BookOpen, Calendar, MessageCircle, Sparkles, User } from 'lucide-react'
import { ChatUnreadCountBadge } from '@/components/chat/chat-unread-count-badge'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUnreadChatCount } from '@/hooks/use-unread-chat-count'
import {
  CHAT_INBOX_HREF,
  DASHBOARD_TAB_HREFS,
} from '@/src/lib/mobile-bottom-nav-routes'

const triggerClassName = 'gap-1.5 px-2 py-2 text-xs sm:text-sm'

type DashboardDesktopNavProps = {
  /** When true, dashboard sections link to /dashboard tabs (for /chat and other hub routes). */
  linkDashboardTabs?: boolean
}

function DashboardNavTrigger({
  value,
  href,
  linkDashboardTabs,
  children,
}: {
  value: string
  href?: string
  linkDashboardTabs: boolean
  children: React.ReactNode
}) {
  if (linkDashboardTabs && href) {
    return (
      <TabsTrigger value={value} asChild className={triggerClassName}>
        <Link href={href}>{children}</Link>
      </TabsTrigger>
    )
  }

  return (
    <TabsTrigger value={value} className={triggerClassName}>
      {children}
    </TabsTrigger>
  )
}

export function DashboardDesktopNav({
  linkDashboardTabs = false,
}: DashboardDesktopNavProps) {
  const unreadChatCount = useUnreadChatCount()

  return (
    <TabsList className="mx-auto hidden h-auto w-full max-w-4xl grid-cols-2 gap-1 p-1 sm:grid sm:grid-cols-5">
      <DashboardNavTrigger
        value="profile"
        href={DASHBOARD_TAB_HREFS.profile}
        linkDashboardTabs={linkDashboardTabs}
      >
        <User className="h-4 w-4 shrink-0" />
        <span className="truncate">Profile</span>
      </DashboardNavTrigger>
      <DashboardNavTrigger
        value="pools"
        href={DASHBOARD_TAB_HREFS.pools}
        linkDashboardTabs={linkDashboardTabs}
      >
        <Sparkles className="h-4 w-4 shrink-0" />
        <span className="truncate">Active Pools</span>
      </DashboardNavTrigger>
      <DashboardNavTrigger
        value="games"
        href={DASHBOARD_TAB_HREFS.upcoming}
        linkDashboardTabs={linkDashboardTabs}
      >
        <Calendar className="h-4 w-4 shrink-0" />
        <span className="truncate">Upcoming Games</span>
      </DashboardNavTrigger>
      <DashboardNavTrigger
        value="how-it-works"
        href={DASHBOARD_TAB_HREFS['how-it-works']}
        linkDashboardTabs={linkDashboardTabs}
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        <span className="truncate">How It Works</span>
      </DashboardNavTrigger>
      <TabsTrigger value="chat" asChild className={triggerClassName}>
        <Link href={CHAT_INBOX_HREF}>
          <span className="relative shrink-0">
            <MessageCircle className="h-4 w-4" aria-hidden />
            <span className="pointer-events-none absolute -right-1.5 -top-1.5">
              <ChatUnreadCountBadge
                count={unreadChatCount}
                className="min-h-4 min-w-4 px-1 text-[9px] leading-none"
              />
            </span>
          </span>
          <span className="truncate">Chat</span>
        </Link>
      </TabsTrigger>
    </TabsList>
  )
}
