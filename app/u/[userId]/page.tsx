import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PublicProfileView } from '@/components/profile/public-profile-view'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import {
  careerFromProgress,
  favoriteSportChips,
  fetchPublicProfile,
  fetchUserAchievementsReadOnly,
} from '@/src/lib/fetch-public-profile'
import {
  fetchProfileRecentActivity,
} from '@/src/lib/fetch-profile-activity'
import { fetchUserAchievementProgress } from '@/src/lib/fetch-user-achievements'
import { fetchUserGlobalRank } from '@/src/lib/global-rank'
import { xpToLevel } from '@/src/lib/levels'
import {
  isUserIdSlug,
  resolveUsernameToUserId,
} from '@/src/lib/resolve-username'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

export const dynamic = 'force-dynamic'

type PublicProfilePageProps = {
  params: Promise<{ userId: string }>
}

async function resolveProfileUserId(slug: string): Promise<string | null> {
  const trimmed = slug.trim()
  if (!trimmed) return null

  const supabase = await createServerSupabaseClient()

  if (isUserIdSlug(trimmed)) {
    return trimmed
  }

  return resolveUsernameToUserId(supabase, trimmed)
}

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { userId: slug } = await params
  const userId = await resolveProfileUserId(slug)
  if (!userId) {
    return { title: 'Player not found · PoolCup' }
  }

  const supabase = await createServerSupabaseClient()
  const profile = await fetchPublicProfile(supabase, userId)
  if (!profile) {
    return { title: 'Player not found · PoolCup' }
  }

  const displayName = profile.display_name?.trim() || 'PoolCup player'
  const handle = profile.username?.trim()
  const level = xpToLevel(profile.total_xp)
  const title = handle
    ? `${displayName} (@${handle}) · PoolCup`
    : `${displayName} · PoolCup`
  const description = [
    `${displayName}'s PoolCup profile`,
    handle ? `@${handle}` : null,
    `Level ${level.level}`,
    `${profile.predictions_made} predictions`,
    profile.accuracy != null ? `${profile.accuracy}% accuracy` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: handle ? `/u/${handle}` : `/u/${userId}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { userId: slug } = await params
  if (!slug?.trim()) notFound()

  const supabase = await createServerSupabaseClient()
  const resolvedId = await resolveProfileUserId(slug)
  if (!resolvedId) notFound()

  const profile = await fetchPublicProfile(supabase, resolvedId)
  if (!profile) notFound()

  // Canonical vanity URL when username exists and visitor used UUID.
  if (
    isUserIdSlug(slug) &&
    profile.username?.trim() &&
    profile.username.trim().toLowerCase() !== slug.trim().toLowerCase()
  ) {
    permanentRedirect(`/u/${profile.username.trim().toLowerCase()}`)
  }

  const [
    {
      data: { user: viewer },
    },
    achievements,
    progress,
    activity,
    globalRank,
  ] = await Promise.all([
    supabase.auth.getUser(),
    fetchUserAchievementsReadOnly(supabase, profile.id),
    fetchUserAchievementProgress(supabase, profile.id),
    fetchProfileRecentActivity(supabase, profile.id, { limit: 12 }),
    fetchUserGlobalRank(supabase, profile.id),
  ])

  const isOwnPublicProfile = viewer?.id === profile.id
  const displayName = profile.display_name?.trim() || 'PoolCup player'
  const career = careerFromProgress(profile, progress)
  const favorites = favoriteSportChips(profile.favorite_sports)

  return (
    <main
      className={cn(
        'mx-auto min-h-screen w-full max-w-lg bg-app-background px-4 py-6 sm:py-8',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <p className="text-sm text-muted-foreground">Player profile</p>
      </div>

      <PublicProfileView
        userId={profile.id}
        username={profile.username ?? null}
        displayName={displayName}
        avatar={resolveAvatarFilename(profile.avatar)}
        customAvatarUrl={profile.custom_avatar_url}
        predictionsMade={career.predictionsMade}
        accuracy={career.accuracy}
        totalPoints={career.totalPoints}
        exactScores={career.exactScores}
        friendsCount={profile.friends_count ?? 0}
        favoriteSports={favorites}
        createdAt={profile.created_at || null}
        isOwnPublicProfile={isOwnPublicProfile}
        initialAchievements={achievements}
        initialActivity={activity.items}
        initialGlobalRank={globalRank}
        loadError={activity.error ? activity.error : null}
        highestLevel={profile.highest_level}
      />
    </main>
  )
}
