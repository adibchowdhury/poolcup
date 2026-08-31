/**
 * User preset avatars in public/avatars/ — keep in sync with that folder.
 * (Distinct from pool crests in public/pool_avatars/.)
 */
export const USER_AVATAR_FILENAMES = [
  'brown_skin_avatar.png',
  'cheerleader.png',
  'goal_keeper.png',
  'goal_keeper_red.png',
  'white_skin_avatar.png',
  'white_skin_avatar_girl.png',
] as const

export type UserAvatarFilename = (typeof USER_AVATAR_FILENAMES)[number]

/** Default when avatar is null/invalid — must exist under public/avatars/. */
export const DEFAULT_AVATAR: UserAvatarFilename = 'white_skin_avatar.png'

const USER_AVATAR_FILENAME_SET = new Set<string>(USER_AVATAR_FILENAMES)

/** Legacy level-N filenames (assets not shipped yet; treated as presets for delete-account). */
const LEGACY_LEVEL_AVATAR_PATTERN = /^level-\d+\.(png|jpg|jpeg|webp)$/i

function isSafeAvatarFilename(filename: string): boolean {
  return /^[a-zA-Z0-9._/-]+\.(png|jpg|jpeg|webp)$/i.test(filename)
}

/** Preset filenames under public/avatars (not Supabase Storage uploads). */
export function isPresetAvatarFilename(
  filename: string | null | undefined,
): boolean {
  if (!filename) return false
  const normalized = filename
    .trim()
    .replace(/^\/+/, '')
    .replace(/^avatars\//i, '')
  return (
    USER_AVATAR_FILENAME_SET.has(normalized) ||
    LEGACY_LEVEL_AVATAR_PATTERN.test(normalized)
  )
}

export function resolveAvatarFilename(
  avatar: string | null | undefined,
): string {
  if (!avatar) {
    return DEFAULT_AVATAR
  }

  const normalized = avatar
    .trim()
    .replace(/^\/+/, '')
    .replace(/^avatars\//i, '')

  // Known shipped presets
  if (USER_AVATAR_FILENAME_SET.has(normalized)) {
    return normalized
  }

  // Legacy level-N refs → default until level art lands in public/avatars
  if (LEGACY_LEVEL_AVATAR_PATTERN.test(normalized)) {
    return DEFAULT_AVATAR
  }

  if (isSafeAvatarFilename(normalized)) {
    return normalized
  }

  return DEFAULT_AVATAR
}

/** Preset-only src. Always returns a path under /avatars/. */
export function getAvatarSrc(avatar: string | null | undefined): string {
  return `/avatars/${resolveAvatarFilename(avatar)}`
}

export type UserAvatarFields = {
  customAvatarUrl?: string | null
  avatar?: string | null
}

/**
 * User avatar resolution: custom Storage URL → preset filename → DEFAULT preset.
 * Never empty — always a usable image src (file must exist in public/avatars).
 */
export function getUserAvatarSrc({
  customAvatarUrl,
  avatar,
}: UserAvatarFields): string {
  const custom = customAvatarUrl?.trim()
  if (custom) return custom
  return getAvatarSrc(avatar)
}
