import { ChatInboxSkeleton } from '@/components/chat/chat-inbox-skeleton'
import { HubPageLoadingShell } from '@/components/dashboard/hub-page-loading-shell'
import { ShimmerBlock } from '@/components/ui/shimmer-block'

export default function ChatLoading() {
  return (
    <HubPageLoadingShell
      label="Loading chats"
      mainClassName="py-6 sm:py-8"
    >
      <div className="mx-auto w-full max-w-2xl">
        <ShimmerBlock className="h-8 w-28 rounded-md sm:h-9 sm:w-32" />
        <ChatInboxSkeleton />
      </div>
    </HubPageLoadingShell>
  )
}
