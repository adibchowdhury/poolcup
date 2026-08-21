import { redirect } from 'next/navigation'
import { ChatAppShell } from '@/components/chat/chat-app-shell'
import { resolveUserDisplayName } from '@/src/lib/auth'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Shared layout for /chat and /chat/[conversationId].
 * Keeps the desktop inbox pane mounted while the right pane (children) swaps
 * on selection — URL stays /chat or /chat/:id.
 */
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/chat')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, avatar, custom_avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <ChatAppShell
      userId={user.id}
      email={user.email ?? ''}
      displayName={resolveUserDisplayName(
        profile?.display_name,
        user.user_metadata,
      )}
      avatar={profile?.avatar ?? null}
      customAvatarUrl={profile?.custom_avatar_url ?? null}
    >
      {children}
    </ChatAppShell>
  )
}
