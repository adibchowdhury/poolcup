export const DEFAULT_AVATAR = 'level-1.png'

const PRESET_AVATAR_PATTERN = /^level-\d+\.(png|jpg|jpeg|webp)$/i

function isSafeAvatarFilename(filename: string): boolean {
  return /^[a-zA-Z0-9._/-]+\.(png|jpg|jpeg|webp)$/i.test(filename)
}

/** Preset level avatars served from public/avatars (not Supabase Storage uploads). */
export function isPresetAvatarFilename(filename: string | null | undefined): boolean {
  if (!filename) return false
  return PRESET_AVATAR_PATTERN.test(filename)
}

export function resolveAvatarFilename(avatar: string | null | undefined): string {
  if (!avatar) {
    return DEFAULT_AVATAR
  }

  const normalized = avatar
    .trim()
    .replace(/^\/+/, '')
    .replace(/^avatars\//i, '')

  if (isSafeAvatarFilename(normalized)) {
    return normalized
  }

  return DEFAULT_AVATAR
}

export function getAvatarSrc(avatar: string | null | undefined): string {
  return `/avatars/${resolveAvatarFilename(avatar)}`
}
