export const DEFAULT_AVATAR = 'level-1.png'

function isSafeAvatarFilename(filename: string): boolean {
  return /^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/i.test(filename)
}

export function resolveAvatarFilename(avatar: string | null | undefined): string {
  if (avatar && isSafeAvatarFilename(avatar)) {
    return avatar
  }

  return DEFAULT_AVATAR
}

export function getAvatarSrc(avatar: string | null | undefined): string {
  return `/avatars/${resolveAvatarFilename(avatar)}`
}
