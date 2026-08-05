'use client'

import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import { PoolLeaderboardStandings } from '@/components/pool/pool-leaderboard-standings'

/**
 * Static example standings for the landing "Watch the standings shake" preview.
 * Podium (3) + short list (3) — no DB, polling, or profile links.
 */
const LANDING_EXAMPLE_STANDINGS: LeaderboardMember[] = [
  {
    id: 'landing-lb-1',
    userId: '',
    name: 'Maya Okonkwo',
    isYou: false,
    avatar: 'goal_keeper.png',
    customAvatarUrl: null,
    points: 167,
    correctPredictions: 21,
    totalPredictions: 24,
    rank: 1,
    prevRank: 3,
    rankDelta: 2,
    movement: 'up',
    climbStreak: 5,
    streak: 5,
  },
  {
    id: 'landing-lb-2',
    userId: '',
    name: 'Jordan Hale',
    isYou: false,
    avatar: 'brown_skin_avatar.png',
    customAvatarUrl: null,
    points: 142,
    correctPredictions: 18,
    totalPredictions: 24,
    rank: 2,
    prevRank: 2,
    rankDelta: 0,
    movement: 'none',
    climbStreak: 1,
    streak: 1,
  },
  {
    id: 'landing-lb-3',
    userId: '',
    name: 'Sofia Reyes',
    isYou: false,
    avatar: 'white_skin_avatar_girl.png',
    customAvatarUrl: null,
    points: 128,
    correctPredictions: 16,
    totalPredictions: 24,
    rank: 3,
    prevRank: 1,
    rankDelta: 2,
    movement: 'down',
    climbStreak: 0,
    streak: 0,
  },
  {
    id: 'landing-lb-4',
    userId: '',
    name: 'Chris Nguyen',
    isYou: false,
    avatar: 'goal_keeper_red.png',
    customAvatarUrl: null,
    points: 98,
    correctPredictions: 12,
    totalPredictions: 24,
    rank: 4,
    prevRank: 7,
    rankDelta: 3,
    movement: 'up',
    climbStreak: 4,
    streak: 4,
  },
  {
    id: 'landing-lb-5',
    userId: '',
    name: 'Alex Rivera',
    isYou: true,
    avatar: 'cheerleader.png',
    customAvatarUrl: null,
    points: 91,
    correctPredictions: 11,
    totalPredictions: 24,
    rank: 5,
    prevRank: 8,
    rankDelta: 3,
    movement: 'up',
    climbStreak: 3,
    streak: 3,
  },
  {
    id: 'landing-lb-6',
    userId: '',
    name: 'Priya Shah',
    isYou: false,
    avatar: 'white_skin_avatar.png',
    customAvatarUrl: null,
    points: 84,
    correctPredictions: 10,
    totalPredictions: 24,
    rank: 6,
    prevRank: 5,
    rankDelta: 1,
    movement: 'down',
    climbStreak: 0,
    streak: 0,
  },
]

function noopInvite() {
  // Landing preview — invite CTA hidden via acceptingMembers={false}.
}

export function LandingLeaderboardPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      <PoolLeaderboardStandings
        members={LANDING_EXAMPLE_STANDINGS}
        acceptingMembers={false}
        copied={false}
        onInvite={noopInvite}
        disableProfileLinks
        className="rounded-2xl pb-3 pt-4"
      />
    </div>
  )
}
