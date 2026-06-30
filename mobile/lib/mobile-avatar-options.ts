/**
 * Preset avatars in mobile/public/avatars — keep in sync with copied assets
 * (same set as GET /api/avatars on the website).
 */
export const MOBILE_AVATAR_FILENAMES = [
  'brown_skin_avatar.png',
  'cheerleader.png',
  'goal_keeper.png',
  'goal_keeper_red.png',
  'white_skin_avatar.png',
  'white_skin_avatar_girl.png',
] as const

export type MobileAvatarFilename = (typeof MOBILE_AVATAR_FILENAMES)[number]
