/**
 * TEMPORARY — remove after design review.
 *
 * Throwaway mock standings for previewing the redesigned Leaderboard tab
 * (podium + ranked list + fire streaks + rank movement + own-row highlight).
 * Not wired to the DB. Flip USE_MOCK_LEADERBOARD to false (or delete this file
 * and its import) to restore live data.
 */
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'

/** Set true only for local design preview of mock standings. */
export const USE_MOCK_LEADERBOARD = false

/**
 * TEMPORARY — which place is "you".
 * - 5 = own-row highlight in the ranked list (default preview)
 * - 1 | 2 | 3 = own-row highlight on the podium
 */
export const MOCK_OWN_PLACE = 5 as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

type MockSeed = {
  place: number
  name: string
  avatar: string
  points: number
  /** Previous rank for ▲/▼; null = unchanged/new (dash). */
  prevRank: number | null
  climbStreak: number
}

function movementFrom(
  rank: number,
  prevRank: number | null,
): Pick<LeaderboardMember, 'movement' | 'rankDelta'> {
  if (prevRank == null || prevRank <= 0) {
    return { movement: 'none', rankDelta: 0 }
  }
  const delta = prevRank - rank
  if (delta > 0) return { movement: 'up', rankDelta: delta }
  if (delta < 0) return { movement: 'down', rankDelta: Math.abs(delta) }
  return { movement: 'none', rankDelta: 0 }
}

/**
 * TEMPORARY mock dataset (~9 members) exercising every redesigned feature.
 * Avatars are real files under /public/avatars.
 */
const MOCK_LEADERBOARD_SEEDS: MockSeed[] = [
  // Podium — fire on #1 and #2
  {
    place: 1,
    name: 'Maya Okonkwo',
    avatar: 'goal_keeper.png',
    points: 142,
    prevRank: 3, // ▲2
    climbStreak: 5,
  },
  {
    place: 2,
    name: 'Jordan Hale',
    avatar: 'brown_skin_avatar.png',
    points: 128,
    prevRank: 2, // —
    climbStreak: 3,
  },
  {
    place: 3,
    name: 'Sofia Reyes',
    avatar: 'white_skin_avatar_girl.png',
    points: 121,
    prevRank: 1, // ▼2
    climbStreak: 1,
  },
  // Ranked list — fire on #4 and #9
  {
    place: 4,
    name: 'Chris Nguyen',
    avatar: 'goal_keeper_red.png',
    points: 98,
    prevRank: 7, // ▲3
    climbStreak: 4,
  },
  {
    place: 5,
    name: 'Alex Rivera',
    avatar: 'cheerleader.png',
    points: 91,
    prevRank: 4, // ▼1
    climbStreak: 2,
  },
  {
    place: 6,
    name: 'Priya Shah',
    avatar: 'white_skin_avatar.png',
    points: 84,
    prevRank: null, // new / —
    climbStreak: 0,
  },
  {
    place: 7,
    name: 'Marcus Bell',
    avatar: 'goal_keeper.png',
    points: 76,
    prevRank: 5, // ▼2
    climbStreak: 1,
  },
  {
    place: 8,
    name: 'Elena Costa',
    avatar: 'brown_skin_avatar.png',
    points: 63,
    prevRank: 8, // —
    climbStreak: 0,
  },
  {
    place: 9,
    name: 'Sam Okada',
    avatar: 'white_skin_avatar_girl.png',
    points: 52,
    prevRank: 11, // ▲2
    climbStreak: 3,
  },
]

/** TEMPORARY — builds LeaderboardMember[] with current user slotted at MOCK_OWN_PLACE. */
export function buildMockLeaderboardMembers(
  currentUserId: string,
): LeaderboardMember[] {
  const ownPlace = MOCK_OWN_PLACE

  return MOCK_LEADERBOARD_SEEDS.map((seed) => {
    const isYou = seed.place === ownPlace
    const { movement, rankDelta } = movementFrom(seed.place, seed.prevRank)
    return {
      id: `mock-member-${seed.place}`,
      userId: isYou ? currentUserId : `mock-user-${seed.place}`,
      name: seed.name,
      isYou,
      avatar: seed.avatar,
      customAvatarUrl: null,
      points: seed.points,
      correctPredictions: Math.max(0, Math.round(seed.points / 8)),
      exactScores: Math.max(0, Math.round(seed.points / 20)),
      totalPredictions: 24,
      rank: seed.place,
      prevRank: seed.prevRank,
      rankDelta,
      movement,
      climbStreak: seed.climbStreak,
      streak: seed.climbStreak,
      pointBreakdown: [],
    }
  })
}
