import { DEFAULT_AVATAR, getAvatarSrc } from '@/src/lib/avatars'

export type PlayerLevelTier = {
  level: number
  minPoints: number
  title: string
}

/** PoolCup ranks by global user points (public.users.points). */
export const PLAYER_LEVEL_TIERS: readonly PlayerLevelTier[] = [
  { level: 1, minPoints: 0, title: 'Benchwarmer' },
  { level: 2, minPoints: 100, title: 'Kickabout' },
  { level: 3, minPoints: 300, title: 'Pitch Rat' },
  { level: 4, minPoints: 600, title: "Scout's Eye" },
  { level: 5, minPoints: 1_000, title: 'Hat Trick Hero' },
  { level: 6, minPoints: 1_500, title: 'Playmaker' },
  { level: 7, minPoints: 2_100, title: 'Golden Boot' },
  { level: 8, minPoints: 3_000, title: 'Top of the Table' },
  { level: 9, minPoints: 4_000, title: 'Extra Time' },
  { level: 10, minPoints: 5_000, title: 'The GOAT' },
] as const

export const MAX_PLAYER_LEVEL = PLAYER_LEVEL_TIERS.length

/**
 * Levels with a dedicated PNG in public/avatars (level-N.png).
 * Currently empty — level art not shipped; getAvatarSrcForLevel uses DEFAULT_AVATAR.
 * Add N here when level-N.png is added to public/avatars.
 */
export const AVATAR_ASSET_LEVELS: readonly number[] = []

export function getPlayerLevelFromPoints(totalPoints: number): PlayerLevelTier {
  const points = Math.max(0, totalPoints)
  let current = PLAYER_LEVEL_TIERS[0]!

  for (const tier of PLAYER_LEVEL_TIERS) {
    if (points >= tier.minPoints) {
      current = tier
    }
  }

  return current
}

/**
 * Level showcase avatar. MISSING ASSET: public/avatars/level-N.png not present —
 * falls back to the default character preset until art is supplied.
 */
export function getAvatarSrcForLevel(level: number): string {
  const clamped = Math.min(Math.max(1, level), MAX_PLAYER_LEVEL)
  if (AVATAR_ASSET_LEVELS.length === 0) {
    return getAvatarSrc(DEFAULT_AVATAR)
  }
  const assetLevel =
    AVATAR_ASSET_LEVELS.filter((l) => l <= clamped).at(-1) ??
    AVATAR_ASSET_LEVELS[0]!
  return `/avatars/level-${assetLevel}.png`
}
