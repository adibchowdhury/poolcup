/**
 * Static achievements / badges catalogue (UI shell).
 *
 * TODO(data): Replace this file with rows from an `achievements` (or similar)
 * DB table. Keep the shape stable so the page and dashboard can swap sources
 * without redesigning cards.
 *
 * TODO(tracking): Earned state will come from a `user_achievements` join —
 * do not invent awarding logic here.
 */

import { achievementBadgeImageSrc } from '@/src/lib/achievement-badge-art'

export { ACHIEVEMENT_PLACEHOLDER_IMAGE } from '@/src/lib/achievement-badge-art'

export const ACHIEVEMENT_CATEGORIES = [
  'Prediction Volume',
  'Accuracy / Correctness',
  'Points Milestones',
  'Pools',
  'Social / Invites',
  'Engagement / Streaks',
  'Ranking',
  'Event / Collection',
] as const

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number]

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export type AchievementBadge = {
  id: string
  name: string
  description: string
  category: AchievementCategory
  tier?: AchievementTier
  /** Id-based art path (`/badges/badge_<id>.png`); UI falls back to placeholder on miss. */
  imageUrl: string
}

function badge(
  partial: Omit<AchievementBadge, 'imageUrl'> & { imageUrl?: string },
): AchievementBadge {
  return {
    imageUrl: achievementBadgeImageSrc(partial.id),
    ...partial,
  }
}

/**
 * Placeholder earned IDs for the UI shell only.
 * TODO(tracking): Replace with real `user_achievements` lookups.
 */
export const PLACEHOLDER_EARNED_ACHIEVEMENT_IDS = [
  'predictions-10',
  'exact-1',
  'points-100',
  'pool-join-1',
  'streak-3',
] as const

export const ACHIEVEMENTS_CATALOGUE: AchievementBadge[] = [
  // —— Prediction Volume ——
  badge({
    id: 'predictions-1',
    name: 'First Pick',
    description: 'Submit your first match prediction.',
    category: 'Prediction Volume',
    tier: 'bronze',
  }),
  badge({
    id: 'predictions-10',
    name: 'Warming Up',
    description: 'Submit 10 predictions.',
    category: 'Prediction Volume',
    tier: 'bronze',
  }),
  badge({
    id: 'predictions-25',
    name: 'Regular',
    description: 'Submit 25 predictions.',
    category: 'Prediction Volume',
    tier: 'silver',
  }),
  badge({
    id: 'predictions-50',
    name: 'Committed',
    description: 'Submit 50 predictions.',
    category: 'Prediction Volume',
    tier: 'silver',
  }),
  badge({
    id: 'predictions-100',
    name: 'Centurion',
    description: 'Submit 100 predictions.',
    category: 'Prediction Volume',
    tier: 'gold',
  }),
  badge({
    id: 'predictions-250',
    name: 'Fixture Fanatic',
    description: 'Submit 250 predictions.',
    category: 'Prediction Volume',
    tier: 'gold',
  }),
  badge({
    id: 'predictions-500',
    name: 'Prediction Machine',
    description: 'Submit 500 predictions.',
    category: 'Prediction Volume',
    tier: 'platinum',
  }),
  badge({
    id: 'predictions-all-round',
    name: 'Full Card',
    description: 'Predict every match in a pool round.',
    category: 'Prediction Volume',
    tier: 'silver',
  }),

  // —— Accuracy / Correctness ——
  badge({
    id: 'exact-1',
    name: 'Bullseye',
    description: 'Nail your first exact score.',
    category: 'Accuracy / Correctness',
    tier: 'bronze',
  }),
  badge({
    id: 'exact-5',
    name: 'Sharpshooter',
    description: 'Get 5 exact scores.',
    category: 'Accuracy / Correctness',
    tier: 'silver',
  }),
  badge({
    id: 'exact-15',
    name: 'Deadeye',
    description: 'Get 15 exact scores.',
    category: 'Accuracy / Correctness',
    tier: 'gold',
  }),
  badge({
    id: 'result-10',
    name: 'Result Hunter',
    description: 'Correctly predict 10 match results.',
    category: 'Accuracy / Correctness',
    tier: 'bronze',
  }),
  badge({
    id: 'result-50',
    name: 'Outcome Oracle',
    description: 'Correctly predict 50 match results.',
    category: 'Accuracy / Correctness',
    tier: 'gold',
  }),
  badge({
    id: 'accuracy-60',
    name: 'Steady Hand',
    description: 'Reach 60% accuracy on at least 20 scored picks.',
    category: 'Accuracy / Correctness',
    tier: 'silver',
  }),
  badge({
    id: 'accuracy-75',
    name: 'Hot Form',
    description: 'Reach 75% accuracy on at least 20 scored picks.',
    category: 'Accuracy / Correctness',
    tier: 'gold',
  }),
  badge({
    id: 'upset-call',
    name: 'Upset Artist',
    description: 'Correctly predict an underdog win.',
    category: 'Accuracy / Correctness',
    tier: 'silver',
  }),

  // —— Points Milestones ——
  badge({
    id: 'points-50',
    name: 'On the Board',
    description: 'Earn 50 total points.',
    category: 'Points Milestones',
    tier: 'bronze',
  }),
  badge({
    id: 'points-100',
    name: 'Triple Digits',
    description: 'Earn 100 total points.',
    category: 'Points Milestones',
    tier: 'bronze',
  }),
  badge({
    id: 'points-250',
    name: 'Climbing',
    description: 'Earn 250 total points.',
    category: 'Points Milestones',
    tier: 'silver',
  }),
  badge({
    id: 'points-500',
    name: 'High Scorer',
    description: 'Earn 500 total points.',
    category: 'Points Milestones',
    tier: 'silver',
  }),
  badge({
    id: 'points-1000',
    name: 'Point Baron',
    description: 'Earn 1,000 total points.',
    category: 'Points Milestones',
    tier: 'gold',
  }),
  badge({
    id: 'points-2500',
    name: 'Scoreboard King',
    description: 'Earn 2,500 total points.',
    category: 'Points Milestones',
    tier: 'platinum',
  }),
  badge({
    id: 'single-haul-20',
    name: 'Big Haul',
    description: 'Score 20+ points from a single match.',
    category: 'Points Milestones',
    tier: 'gold',
  }),
  badge({
    id: 'weekend-50',
    name: 'Weekend Warrior',
    description: 'Earn 50 points across a single weekend of fixtures.',
    category: 'Points Milestones',
    tier: 'silver',
  }),

  // —— Pools ——
  badge({
    id: 'pool-join-1',
    name: 'In the Pool',
    description: 'Join your first prediction pool.',
    category: 'Pools',
    tier: 'bronze',
  }),
  badge({
    id: 'pool-create-1',
    name: 'Pool Host',
    description: 'Create a pool.',
    category: 'Pools',
    tier: 'bronze',
  }),
  badge({
    id: 'pool-join-3',
    name: 'Multi-pooler',
    description: 'Be an active member of 3 pools.',
    category: 'Pools',
    tier: 'silver',
  }),
  badge({
    id: 'pool-fill-8',
    name: 'Party Starter',
    description: 'Host a pool that reaches 8 members.',
    category: 'Pools',
    tier: 'silver',
  }),
  badge({
    id: 'pool-official',
    name: 'Official Entry',
    description: 'Join an official PoolCup pool.',
    category: 'Pools',
    tier: 'bronze',
  }),
  badge({
    id: 'pool-finish',
    name: 'Seen It Through',
    description: 'Finish a pool season to the final matchday.',
    category: 'Pools',
    tier: 'gold',
  }),
  badge({
    id: 'pool-winner',
    name: 'Pool Champion',
    description: 'Finish 1st in a pool.',
    category: 'Pools',
    tier: 'platinum',
  }),
  badge({
    id: 'pool-podium',
    name: 'Podium Finish',
    description: 'Finish top 3 in a pool.',
    category: 'Pools',
    tier: 'gold',
  }),

  // —— Social / Invites ——
  badge({
    id: 'invite-1',
    name: 'Recruiter',
    description: 'Invite a friend who joins a pool.',
    category: 'Social / Invites',
    tier: 'bronze',
  }),
  badge({
    id: 'invite-5',
    name: 'Squad Builder',
    description: 'Invite 5 friends who join.',
    category: 'Social / Invites',
    tier: 'silver',
  }),
  badge({
    id: 'invite-10',
    name: 'Ambassador',
    description: 'Invite 10 friends who join.',
    category: 'Social / Invites',
    tier: 'gold',
  }),
  badge({
    id: 'chat-1',
    name: 'Ice Breaker',
    description: 'Send your first pool chat message.',
    category: 'Social / Invites',
    tier: 'bronze',
  }),
  badge({
    id: 'chat-25',
    name: 'Banter Merchant',
    description: 'Send 25 pool chat messages.',
    category: 'Social / Invites',
    tier: 'silver',
  }),
  badge({
    id: 'rival-tag',
    name: 'Friendly Rival',
    description: 'Pass a friend on a pool leaderboard.',
    category: 'Social / Invites',
    tier: 'silver',
  }),
  badge({
    id: 'share-invite',
    name: 'Link Dropper',
    description: 'Share a pool invite link.',
    category: 'Social / Invites',
    tier: 'bronze',
  }),
  badge({
    id: 'office-crew',
    name: 'Office Crew',
    description: 'Join a pool with 5+ members from the same invite wave.',
    category: 'Social / Invites',
    tier: 'gold',
  }),

  // —— Engagement / Streaks ——
  badge({
    id: 'streak-3',
    name: 'On a Roll',
    description: 'Predict on 3 consecutive matchdays.',
    category: 'Engagement / Streaks',
    tier: 'bronze',
  }),
  badge({
    id: 'streak-7',
    name: 'Week Warrior',
    description: 'Keep a 7-day prediction streak.',
    category: 'Engagement / Streaks',
    tier: 'silver',
  }),
  badge({
    id: 'streak-14',
    name: 'Fortnight Flame',
    description: 'Keep a 14-day prediction streak.',
    category: 'Engagement / Streaks',
    tier: 'gold',
  }),
  badge({
    id: 'streak-30',
    name: 'Monthly Machine',
    description: 'Keep a 30-day prediction streak.',
    category: 'Engagement / Streaks',
    tier: 'platinum',
  }),
  badge({
    id: 'login-7',
    name: 'Checked In',
    description: 'Open PoolCup on 7 different days.',
    category: 'Engagement / Streaks',
    tier: 'bronze',
  }),
  badge({
    id: 'deadline-crunch',
    name: 'Last Whistle',
    description: 'Submit a prediction within 5 minutes of kickoff lock.',
    category: 'Engagement / Streaks',
    tier: 'silver',
  }),
  badge({
    id: 'never-miss',
    name: 'Never Miss',
    description: 'Predict every locked match in a week.',
    category: 'Engagement / Streaks',
    tier: 'gold',
  }),
  badge({
    id: 'comeback',
    name: 'Comeback Kid',
    description: 'Return and predict after 14+ days away.',
    category: 'Engagement / Streaks',
    tier: 'bronze',
  }),

  // —— Ranking ——
  badge({
    id: 'rank-top-10',
    name: 'Top Ten',
    description: 'Reach top 10 in any pool leaderboard.',
    category: 'Ranking',
    tier: 'bronze',
  }),
  badge({
    id: 'rank-top-5',
    name: 'Contender',
    description: 'Reach top 5 in any pool leaderboard.',
    category: 'Ranking',
    tier: 'silver',
  }),
  badge({
    id: 'rank-1',
    name: 'Table Topper',
    description: 'Reach #1 in any pool leaderboard.',
    category: 'Ranking',
    tier: 'gold',
  }),
  badge({
    id: 'rank-hold-3',
    name: 'Stay Sharp',
    description: 'Hold #1 for 3 consecutive matchdays.',
    category: 'Ranking',
    tier: 'platinum',
  }),
  badge({
    id: 'rank-climb-5',
    name: 'Mover',
    description: 'Climb 5+ places in a single scoring window.',
    category: 'Ranking',
    tier: 'silver',
  }),
  badge({
    id: 'rank-global-100',
    name: 'Global 100',
    description: 'Reach the global top 100 (when live).',
    category: 'Ranking',
    tier: 'gold',
  }),
  badge({
    id: 'rank-overtake',
    name: 'Overtake',
    description: 'Pass the previous leader on a leaderboard.',
    category: 'Ranking',
    tier: 'silver',
  }),
  badge({
    id: 'rank-photo-finish',
    name: 'Photo Finish',
    description: 'Finish within 5 points of 1st place.',
    category: 'Ranking',
    tier: 'gold',
  }),

  // —— Event / Collection ——
  badge({
    id: 'event-first',
    name: 'Kickoff Collector',
    description: 'Predict in your first live sporting event.',
    category: 'Event / Collection',
    tier: 'bronze',
  }),
  badge({
    id: 'event-premier',
    name: 'Premier Patch',
    description: 'Predict matches in the Premier League.',
    category: 'Event / Collection',
    tier: 'bronze',
  }),
  badge({
    id: 'event-laliga',
    name: 'La Liga Patch',
    description: 'Predict matches in La Liga.',
    category: 'Event / Collection',
    tier: 'bronze',
  }),
  badge({
    id: 'event-mls',
    name: 'MLS Patch',
    description: 'Predict matches in MLS.',
    category: 'Event / Collection',
    tier: 'bronze',
  }),
  badge({
    id: 'event-ucl',
    name: 'Champions Night',
    description: 'Predict in a Champions League window.',
    category: 'Event / Collection',
    tier: 'silver',
  }),
  badge({
    id: 'event-world-cup',
    name: 'World Cup Edition',
    description: 'Predict in a World Cup event.',
    category: 'Event / Collection',
    tier: 'gold',
  }),
  badge({
    id: 'event-triple',
    name: 'Triple Threat',
    description: 'Predict across 3 different competitions.',
    category: 'Event / Collection',
    tier: 'silver',
  }),
  badge({
    id: 'event-full-set',
    name: 'Full Set',
    description: 'Collect a patch from every live league on PoolCup.',
    category: 'Event / Collection',
    tier: 'platinum',
  }),
]

export type AchievementWithStatus = AchievementBadge & {
  earned: boolean
}

export function isPlaceholderEarned(id: string): boolean {
  return (PLACEHOLDER_EARNED_ACHIEVEMENT_IDS as readonly string[]).includes(id)
}

export function getAchievementsGroupedByCategory(
  earnedIds: ReadonlySet<string> = new Set(PLACEHOLDER_EARNED_ACHIEVEMENT_IDS),
): { category: AchievementCategory; badges: AchievementWithStatus[] }[] {
  return ACHIEVEMENT_CATEGORIES.map((category) => ({
    category,
    badges: ACHIEVEMENTS_CATALOGUE.filter((badge) => badge.category === category).map(
      (badge) => ({
        ...badge,
        earned: earnedIds.has(badge.id),
      }),
    ),
  })).filter((group) => group.badges.length > 0)
}

export function getAchievementSummary(
  earnedIds: ReadonlySet<string> = new Set(PLACEHOLDER_EARNED_ACHIEVEMENT_IDS),
) {
  const total = ACHIEVEMENTS_CATALOGUE.length
  const earned = ACHIEVEMENTS_CATALOGUE.filter((badge) =>
    earnedIds.has(badge.id),
  ).length
  return { earned, total }
}
