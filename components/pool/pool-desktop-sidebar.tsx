'use client'

/**
 * Shared pool desktop sidebar — leaderboard + predictions.
 * Re-exports the leaderboard shell sidebar as the single shared component
 * (nav · pool info · recent activity · Commissioner CTA). Active TabsTrigger
 * is the only per-page difference (Radix Tabs value).
 */
export {
  PoolLeaderboardDesktopSidebar as PoolDesktopSidebar,
  PoolLeaderboardDesktopSidebar,
  activityItemCapForViewportHeight,
  buildPoolLeaderboardActivity,
  POOL_LEADERBOARD_SIDEBAR_WIDTH_CLASS,
  type PoolLeaderboardDesktopSidebarProps as PoolDesktopSidebarProps,
  type PoolLeaderboardDesktopSidebarProps,
  type PoolLeaderboardShellPool,
  type PoolLeaderboardShellPool as PoolDesktopShellPool,
  type PoolLeaderboardActivityItem,
} from '@/components/pool/pool-leaderboard-desktop-sidebar'
