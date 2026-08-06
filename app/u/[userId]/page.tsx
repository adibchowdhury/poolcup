import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PublicProfileView } from '@/components/profile/public-profile-view'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import {
  fetchPublicProfile,
  fetchUserAchievementsReadOnly,
} from '@/src/lib/fetch-public-profile'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

export const dynamic = 'force-dynamic'

type PublicProfilePageProps = {
  params: Promise<{ userId: string }>
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { userId } = await params
  if (!userId?.trim()) notFound()

  const supabase = await createServerSupabaseClient()
  const profile = await fetchPublicProfile(supabase, userId)
  if (!profile) notFound()

  const [
    {
      data: { user: viewer },
    },
    achievements,
  ] = await Promise.all([
    supabase.auth.getUser(),
    fetchUserAchievementsReadOnly(supabase, userId),
  ])

  const isOwnPublicProfile = viewer?.id === profile.id
  const displayName =
    profile.display_name?.trim() || 'PoolCup player'

  return (
    <main
      className={cn(
        'mx-auto min-h-screen w-full max-w-lg px-4 py-6 sm:py-8',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <p className="text-sm text-muted-foreground">Player profile</p>
      </div>

      <PublicProfileView
        userId={profile.id}
        displayName={displayName}
        avatar={resolveAvatarFilename(profile.avatar)}
        customAvatarUrl={profile.custom_avatar_url}
        predictionsMade={profile.predictions_made}
        accuracy={profile.accuracy}
        createdAt={profile.created_at || null}
        isOwnPublicProfile={isOwnPublicProfile}
        initialAchievements={achievements}
      />
    </main>
  )
}
