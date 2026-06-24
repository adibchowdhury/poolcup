/** Preset squad photos in public/pool_avatars/ — keep in sync with that folder. */
export const POOL_AVATAR_FILENAMES = [
  'brown_skin_avatar.png',
  'cheerleader.png',
  'goal_keeper.png',
  'goal_keeper_red.png',
  'white_skin_avatar.png',
  'white_skin_avatar_girl.png',
] as const

export type PoolAvatarFilename = (typeof POOL_AVATAR_FILENAMES)[number]

const POOL_AVATAR_FILENAME_SET = new Set<string>(POOL_AVATAR_FILENAMES)

function isSafePoolAvatarFilename(filename: string): boolean {
  return /^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/i.test(filename)
}

export function isPoolAvatarFilename(
  filename: string | null | undefined,
): filename is PoolAvatarFilename {
  return Boolean(filename && POOL_AVATAR_FILENAME_SET.has(filename))
}

export function resolvePoolAvatarFilename(
  avatar: string | null | undefined,
): PoolAvatarFilename | null {
  if (!avatar) return null

  const normalized = avatar
    .trim()
    .replace(/^\/+/, '')
    .replace(/^pool_avatars\//i, '')

  if (isSafePoolAvatarFilename(normalized) && POOL_AVATAR_FILENAME_SET.has(normalized)) {
    return normalized as PoolAvatarFilename
  }

  return null
}

export function getPoolAvatarSrc(avatar: string | null | undefined): string | null {
  const resolved = resolvePoolAvatarFilename(avatar)
  return resolved ? `/pool_avatars/${resolved}` : null
}
