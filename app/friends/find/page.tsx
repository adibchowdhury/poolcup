import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { FriendsFindPageView } from '@/components/friends/friends-find-page-view'
import { resolveUserDisplayName } from '@/src/lib/auth'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Find friends | PoolCup',
  description: 'Search PoolCup players by username or name and send friend requests.',
}

function FindFallback() {
  return (
    <main
      className={cn(
        'flex min-h-screen items-center justify-center bg-app-background',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  )
}

export default async function FriendsFindPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/friends/find')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, avatar, custom_avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <Suspense fallback={<FindFallback />}>
      <FriendsFindPageView
        userId={user.id}
        email={user.email ?? ''}
        displayName={resolveUserDisplayName(
          profile?.display_name,
          user.user_metadata,
        )}
        avatar={profile?.avatar ?? null}
        customAvatarUrl={profile?.custom_avatar_url ?? null}
      />
    </Suspense>
  )
}
