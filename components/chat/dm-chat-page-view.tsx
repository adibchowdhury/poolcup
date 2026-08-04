'use client'

import { DmChatThread } from '@/components/chat/dm-chat-thread'
import { DashboardAppShell } from '@/components/dashboard/dashboard-app-shell'
import type { DmConversationRow } from '@/src/lib/dm-chats'

type DmChatPageViewProps = {
  conversationId: string
  userId: string
  email: string
  displayName?: string | null
  avatar?: string | null
  customAvatarUrl?: string | null
  initialConversation?: DmConversationRow | null
}

export function DmChatPageView({
  conversationId,
  userId,
  email,
  displayName,
  avatar,
  customAvatarUrl,
  initialConversation = null,
}: DmChatPageViewProps) {
  return (
    <DashboardAppShell
      userId={userId}
      email={email}
      displayName={displayName}
      avatar={avatar}
      customAvatarUrl={customAvatarUrl}
      mainClassName="py-4 sm:py-8"
    >
      <DmChatThread
        conversationId={conversationId}
        currentUserId={userId}
        initialConversation={initialConversation}
      />
    </DashboardAppShell>
  )
}
