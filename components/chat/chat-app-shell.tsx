'use client'

import { usePathname } from 'next/navigation'
import {
  ChatDesktopTwoPane,
  useIsChatDesktopLayout,
} from '@/components/chat/chats-page-view'
import { DashboardAppShell } from '@/components/dashboard/dashboard-app-shell'
import { cn } from '@/lib/utils'

type ChatAppShellProps = {
  userId: string
  email: string
  displayName?: string | null
  avatar?: string | null
  customAvatarUrl?: string | null
  children: React.ReactNode
}

/**
 * Persistent chat chrome for /chat, /chat/[conversationId], and /chat/pool/[invite_code].
 * Desktop (lg+): two-pane shell stays mounted across selection so the inbox
 * does not remount when the URL changes. Mobile: children only (inbox page or
 * standalone thread).
 */
export function ChatAppShell({
  userId,
  email,
  displayName,
  avatar,
  customAvatarUrl,
  children,
}: ChatAppShellProps) {
  const isDesktop = useIsChatDesktopLayout()
  const pathname = usePathname() ?? ''
  const poolMatch = pathname.match(/^\/chat\/pool\/([^/?#]+)/)
  const selectedPoolInviteCode = poolMatch?.[1]
    ? decodeURIComponent(poolMatch[1])
    : null
  const dmMatch = pathname.match(/^\/chat\/(?!pool(?:\/|$))([^/?#]+)/)
  const selectedConversationId = dmMatch?.[1] ?? null

  return (
    <DashboardAppShell
      userId={userId}
      email={email}
      displayName={displayName}
      avatar={avatar}
      customAvatarUrl={customAvatarUrl}
      hubActiveNav="inbox"
      linkDashboardTabs
      mainClassName={cn(
        // Mobile conversation page padding (inbox page supplies its own).
        !isDesktop && selectedConversationId && 'py-4 sm:py-8',
        // Desktop: flush under top bar.
        'lg:px-0 lg:py-0 xl:px-0',
      )}
    >
      {isDesktop ? (
        <ChatDesktopTwoPane
          userId={userId}
          selectedConversationId={selectedConversationId}
          selectedPoolInviteCode={selectedPoolInviteCode}
        >
          {children}
        </ChatDesktopTwoPane>
      ) : (
        children
      )}
    </DashboardAppShell>
  )
}
