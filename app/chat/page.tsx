import { redirect } from 'next/navigation'
import { ChatsPageView } from '@/components/chat/chats-page-view'
import { resolveUserDisplayName } from '@/src/lib/auth'
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

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, avatar')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <ChatsPageView
      userId={user.id}
      email={user.email ?? ''}
      displayName={resolveUserDisplayName(
        profile?.display_name,
        user.user_metadata,
      )}
      avatar={profile?.avatar ?? null}
    />
  )
}
