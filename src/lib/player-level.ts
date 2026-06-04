export type PlayerLevelTier = {
  level: number
  minPoints: number
  title: string
}

/** PoolCup ranks by global user points (public.users.points). */
export const PLAYER_LEVEL_TIERS: readonly PlayerLevelTier[] = [
  { level: 1, minPoints: 0, title: 'Benchwarmer' },
  { level: 2, minPoints: 200, title: 'Substitute' },
  { level: 3, minPoints: 450, title: 'Squad Player' },
  { level: 4, minPoints: 800, title: 'Starter' },
  { level: 5, minPoints: 1200, title: 'Key Player' },
  { level: 6, minPoints: 1800, title: 'Fan Favorite' },
  { level: 7, minPoints: 2500, title: 'Club Legend' },
  { level: 8, minPoints: 3300, title: 'International' },
  { level: 9, minPoints: 4200, title: 'World Class' },
  { level: 10, minPoints: 5000, title: 'GOAT' },
] as const

export const MAX_PLAYER_LEVEL = PLAYER_LEVEL_TIERS.length

/** Levels with a PNG in public/avatars (add N here when level-N.png exists). */
export const AVATAR_ASSET_LEVELS: readonly number[] = [1]

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

export function getAvatarSrcForLevel(level: number): string {
  const clamped = Math.min(Math.max(1, level), MAX_PLAYER_LEVEL)
  const assetLevel =
    AVATAR_ASSET_LEVELS.filter((l) => l <= clamped).at(-1) ??
    AVATAR_ASSET_LEVELS[0]!
  return `/avatars/level-${assetLevel}.png`
}
