'use client'

import { ProfileShowcase } from '@/components/dashboard/profile-showcase'
import type { UserAchievementsData } from '@/src/lib/fetch-user-achievements'

type PublicProfileViewProps = {
  userId: string
  displayName: string
  avatar: string
  customAvatarUrl: string | null
  predictionsMade: number
  accuracy: number | null
  isOwnPublicProfile: boolean
  initialAchievements: UserAchievementsData
}

/**
 * Read-only public profile shell. Never evaluates achievements — data is
 * preloaded server-side via SELECT-only helpers.
 */
export function PublicProfileView({
  userId,
  displayName,
  avatar,
  customAvatarUrl,
  predictionsMade,
  accuracy,
  isOwnPublicProfile,
  initialAchievements,
}: PublicProfileViewProps) {
  return (
    <ProfileShowcase
      mode="public"
      userId={userId}
      displayName={displayName}
      avatar={avatar}
      customAvatarUrl={customAvatarUrl}
      predictionsMade={predictionsMade}
      accuracy={accuracy}
      active
      isOwnPublicProfile={isOwnPublicProfile}
      initialAchievements={initialAchievements}
    />
  )
}
