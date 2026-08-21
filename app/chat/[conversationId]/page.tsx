import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { DmChatPageView } from '@/components/chat/dm-chat-page-view'
import { fetchMyDmConversations } from '@/src/lib/dm-chats'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type DmConversationPageProps = {
  params: Promise<{ conversationId: string }>
}

export default async function DmConversationPage({
  params,
}: DmConversationPageProps) {
  const { conversationId } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/chat/${conversationId}`)
  }

  const conversations = await fetchMyDmConversations(supabase)
  const initialConversation =
    conversations.find((row) => row.conversation_id === conversationId) ?? null

  return (
    <Suspense fallback={null}>
      <DmChatPageView
        conversationId={conversationId}
        userId={user.id}
        initialConversation={initialConversation}
      />
    </Suspense>
  )
}
