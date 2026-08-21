import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ChatsPageView } from '@/components/chat/chats-page-view'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/chat')
  }

  return (
    <Suspense fallback={null}>
      <ChatsPageView userId={user.id} />
    </Suspense>
  )
}
