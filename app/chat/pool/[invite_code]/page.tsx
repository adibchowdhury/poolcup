import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { PoolChatPaneView } from '@/components/chat/pool-chat-pane-view'
import { fetchPoolChatPaneContext } from '@/src/lib/pool-chats'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type PoolChatPanePageProps = {
  params: Promise<{ invite_code: string }>
}

export default async function PoolChatPanePage({
  params,
}: PoolChatPanePageProps) {
  const { invite_code: inviteCode } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/chat/pool/${encodeURIComponent(inviteCode)}`)
  }

  const context = await fetchPoolChatPaneContext(
    supabase,
    inviteCode,
    user.id,
  )

  if (!context) {
    notFound()
  }

  return (
    <Suspense fallback={null}>
      <PoolChatPaneView context={context} currentUserId={user.id} />
    </Suspense>
  )
}
