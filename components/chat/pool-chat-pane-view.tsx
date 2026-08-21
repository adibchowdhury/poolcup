'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PoolChatTab,
  type PoolChatMemberProfile,
} from '@/components/pool/pool-chat-tab'
import { useIsChatDesktopLayout } from '@/components/chat/chats-page-view'
import type { PoolChatPaneContext } from '@/src/lib/pool-chats'
import { getPoolChatHref } from '@/src/lib/pool-unread-counts'

type PoolChatPaneViewProps = {
  context: PoolChatPaneContext
  currentUserId: string
}

/**
 * Right-pane pool chat for /chat/pool/[invite_code] (desktop two-pane shell).
 * Mobile soft-redirects to the existing pool Chat tab URL.
 */
export function PoolChatPaneView({
  context,
  currentUserId,
}: PoolChatPaneViewProps) {
  const router = useRouter()
  const isDesktop = useIsChatDesktopLayout()

  const memberProfilesByUserId = useMemo(() => {
    const map = new Map<string, PoolChatMemberProfile>()
    for (const profile of context.memberProfiles) {
      map.set(profile.userId, {
        displayName: profile.displayName,
        avatar: profile.avatar,
        customAvatarUrl: profile.customAvatarUrl,
      })
    }
    return map
  }, [context.memberProfiles])

  useEffect(() => {
    if (isDesktop) return
    router.replace(getPoolChatHref(context.inviteCode))
  }, [context.inviteCode, isDesktop, router])

  if (!isDesktop) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Opening pool chat…
      </p>
    )
  }

  // Match DmChatThread desktop pane: flush fill, header + messages + composer.
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#0A0E0E]">
      <header className="flex shrink-0 items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 truncate font-display text-xl tracking-wide text-foreground sm:text-2xl">
          {context.poolName}
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <PoolChatTab
          hideHeading
          fullBleedDesktop
          poolId={context.poolId}
          currentUserId={currentUserId}
          poolCreatorUserId={context.poolCreatorUserId}
          memberProfilesByUserId={memberProfilesByUserId}
        />
      </div>
    </div>
  )
}
