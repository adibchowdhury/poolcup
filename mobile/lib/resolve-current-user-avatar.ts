export type CurrentUserAvatarFields = {
  custom_avatar_url: string | null | undefined
  avatar: string | null | undefined
}

export type CurrentUserAvatarState = {
  customAvatarUrl: string | null
  avatarPreset: string | null
}

export function toCurrentUserAvatarState(
  fields: CurrentUserAvatarFields | null | undefined,
): CurrentUserAvatarState {
  return {
    customAvatarUrl: fields?.custom_avatar_url?.trim() || null,
    avatarPreset: fields?.avatar?.trim() || null,
  }
}

function normalizePresetFilename(avatar: string): string | null {
  const normalized = avatar
    .trim()
    .replace(/^\/+/, '')
    .replace(/^avatars\//i, '')

  if (!normalized) return null
  if (!/^[a-zA-Z0-9._/-]+\.(png|jpg|jpeg|webp)$/i.test(normalized)) {
    return null
  }

  return normalized
}

/** Resolved image URL for the current user, or null for empty placeholder. */
export function resolveCurrentUserAvatarSrc(
  fields: CurrentUserAvatarFields,
): string | null {
  const custom = fields.custom_avatar_url?.trim()
  if (custom) return custom

  const preset = fields.avatar?.trim()
  if (!preset) return null

  const filename = normalizePresetFilename(preset)
  if (!filename) return null

  return `/avatars/${filename}`
}

export function hasCurrentUserAvatar(fields: CurrentUserAvatarFields): boolean {
  return resolveCurrentUserAvatarSrc(fields) !== null
}
