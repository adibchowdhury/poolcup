'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  Calendar,
  MessageCircle,
  Sparkles,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatUnreadCountBadge } from '@/components/chat/chat-unread-count-badge'
import { useUnreadChatCount } from '@/hooks/use-unread-chat-count'
import {
  hasAuthenticatedBottomBar,
  isAuthenticatedAppPath,
} from '@/src/lib/authenticated-paths'
import { useMobileInputFocused } from '@/hooks/use-mobile-input-focused'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import {
  CHAT_INBOX_HREF,
  DASHBOARD_TAB_HREFS,
  type MobileBottomNavId,
  resolveMobileBottomNavActive,
} from '@/src/lib/mobile-bottom-nav-routes'

const NAV_ITEMS: {
  id: MobileBottomNavId
  label: string
  href: string
  icon: typeof User
}[] = [
  { id: 'profile', label: 'Profile', href: DASHBOARD_TAB_HREFS.profile, icon: User },
  { id: 'pools', label: 'Pools', href: DASHBOARD_TAB_HREFS.pools, icon: Sparkles },
  {
    id: 'upcoming',
    label: 'Upcoming',
    href: DASHBOARD_TAB_HREFS.upcoming,
    icon: Calendar,
  },
  {
    id: 'how-it-works',
    label: 'How it works',
    href: DASHBOARD_TAB_HREFS['how-it-works'],
    icon: BookOpen,
  },
  { id: 'chat', label: 'Chat', href: CHAT_INBOX_HREF, icon: MessageCircle },
]

function MobileBottomNavContent() {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const { mobileChatActive } = useMobileChatChrome()
  const inputFocused = useMobileInputFocused()

  const tabParam = searchParams.get('tab')
  const activeId = resolveMobileBottomNavActive(pathname, tabParam)
  const unreadChatCount = useUnreadChatCount()
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-md sm:hidden safe-area-pb"
      aria-label="Main navigation"
    >
      <div className="mx-auto grid h-[3.75rem] max-w-lg grid-cols-5 items-stretch px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeId === item.id

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="relative shrink-0">
                <Icon className="h-5 w-5" aria-hidden />
                {item.id === 'chat' ? (
                  <span className="pointer-events-none absolute -right-1.5 -top-1">
                    <ChatUnreadCountBadge
                      count={unreadChatCount}
                      className="min-h-4 min-w-4 px-1 text-[9px] leading-none"
                    />
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{item.label}</span>
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
