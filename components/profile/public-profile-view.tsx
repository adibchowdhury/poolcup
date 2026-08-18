'use client'

import { ProfileShowcase } from '@/components/dashboard/profile-showcase'
import type { UserAchievementsData } from '@/src/lib/fetch-user-achievements'
import type { ProfileActivityItem } from '@/src/lib/fetch-profile-activity'
import type { FavoriteSportChip } from '@/src/lib/fetch-public-profile'
import type { UserGlobalRank } from '@/src/lib/global-rank'

type PublicProfileViewProps = {
  userId: string
  username: string | null
  displayName: string
  avatar: string
  customAvatarUrl: string | null
  predictionsMade: number
  accuracy: number | null
  totalPoints: number
  exactScores: number
  friendsCount: number
  favoriteSports: FavoriteSportChip[]
  createdAt: string | null
  isOwnPublicProfile: boolean
  initialAchievements: UserAchievementsData
  initialActivity: ProfileActivityItem[]
  initialGlobalRank: UserGlobalRank | null
  loadError: string | null
  highestLevel?: number | null
}

/**
 * Read-only public profile shell. Never evaluates achievements — data is
 * preloaded server-side via SELECT-only helpers.
 */
export function PublicProfileView({
  userId,
  username,
  displayName,
  avatar,
  customAvatarUrl,
  predictionsMade,
  accuracy,
  totalPoints,
  exactScores,
  friendsCount,
  favoriteSports,
  createdAt,
  isOwnPublicProfile,
  initialAchievements,
  initialActivity,
  initialGlobalRank,
  loadError,
  highestLevel = null,
}: PublicProfileViewProps) {
  return (
    <ProfileShowcase
      mode="public"
      userId={userId}
      username={username}
      displayName={displayName}
      avatar={avatar}
      customAvatarUrl={customAvatarUrl}
      predictionsMade={predictionsMade}
      accuracy={accuracy}
      totalPoints={totalPoints}
      exactScores={exactScores}
      friendsCount={friendsCount}
      favoriteSports={favoriteSports}
      createdAt={createdAt}
      active
      isOwnPublicProfile={isOwnPublicProfile}
      initialAchievements={initialAchievements}
      initialActivity={initialActivity}
      initialGlobalRank={initialGlobalRank}
      loadError={loadError}
      highestLevel={highestLevel}
    />
  )
}
