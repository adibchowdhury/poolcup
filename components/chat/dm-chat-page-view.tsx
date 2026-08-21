'use client'

import { DmChatThread } from '@/components/chat/dm-chat-thread'
import type { DmConversationRow } from '@/src/lib/dm-chats'

type DmChatPageViewProps = {
  conversationId: string
  userId: string
  initialConversation?: DmConversationRow | null
}

/**
 * Conversation content for /chat/[conversationId].
 * Desktop: rendered in ChatAppShell's right pane (inbox stays mounted in the layout).
 * Mobile: full-page thread via ChatAppShell children-only path.
 */
export function DmChatPageView({
  conversationId,
  userId,
  initialConversation = null,
}: DmChatPageViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DmChatThread
        conversationId={conversationId}
        currentUserId={userId}
        initialConversation={initialConversation}
      />
    </div>
  )
}
