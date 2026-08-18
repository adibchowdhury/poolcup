export const ONBOARDING_STEPS = [
  'welcome',
  'predict_compete',
  'your_pool',
  'sports_identity',
  'better_friends',
  'referral_source',
  'fan_level',
  'motivation_level',
  'create_profile',
  'youre_ready',
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]

/** Info-only slides (no required input). */
export const ONBOARDING_INFO_STEPS: readonly OnboardingStepId[] = [
  'welcome',
  'predict_compete',
  'your_pool',
  'sports_identity',
  'better_friends',
]

export type OnboardingState = {
  step?: OnboardingStepId | string
  favorite_sports?: string[]
  username_draft?: string
  display_name_draft?: string
  referral_source?: string
  fan_level?: number
  motivation_level?: number
  avatar_touched?: boolean
}

export const ONBOARDING_SPORT_OPTIONS = [
  { id: 'soccer', label: 'Soccer', ballSrc: '/sports/soccer.png' },
  { id: 'basketball', label: 'Basketball', ballSrc: '/sports/basketball.png' },
  { id: 'football', label: 'Football', ballSrc: '/sports/football.png' },
  { id: 'hockey', label: 'Hockey', ballSrc: '/sports/hockey.png' },
  { id: 'baseball', label: 'Baseball', ballSrc: '/sports/baseball.png' },
  { id: 'cricket', label: 'Cricket', ballSrc: '/sports/cricket.png' },
] as const

export type OnboardingSportId = (typeof ONBOARDING_SPORT_OPTIONS)[number]['id']

export const ONBOARDING_REFERRAL_OPTIONS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'x', label: 'X' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'google', label: 'Google Search' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'friend', label: 'Friend/Word of mouth' },
  { id: 'other', label: 'Other' },
] as const

export type OnboardingReferralId =
  (typeof ONBOARDING_REFERRAL_OPTIONS)[number]['id']

export function isOnboardingReferralId(
  value: string | null | undefined,
): value is OnboardingReferralId {
  return (
    typeof value === 'string' &&
    (ONBOARDING_REFERRAL_OPTIONS as readonly { id: string }[]).some(
      (opt) => opt.id === value,
    )
  )
}

/** Fan engagement level (1–5). Labels are display-only; store `level`. */
export const ONBOARDING_FAN_LEVEL_OPTIONS = [
  {
    level: 1,
    label: 'I just got an invite from a friend',
  },
  {
    level: 2,
    label: 'I casually follow my hometown teams',
  },
  {
    level: 3,
    label: 'I watch games regularly every week',
  },
  {
    level: 4,
    label: 'I play fantasy and track every stat',
  },
  {
    level: 5,
    label: 'Sports is life—I never miss a game',
  },
] as const

export type OnboardingFanLevel =
  (typeof ONBOARDING_FAN_LEVEL_OPTIONS)[number]['level']

export function isOnboardingFanLevel(
  value: unknown,
): value is OnboardingFanLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

/** Goal / motivation level (1–5). Labels are display-only; store `level`. */
export const ONBOARDING_MOTIVATION_LEVEL_OPTIONS = [
  {
    level: 1,
    label: "I'm here for a friendly pool",
  },
  {
    level: 2,
    label: 'I want to beat my buddies',
  },
  {
    level: 3,
    label: 'I want to test my sports knowledge',
  },
  {
    level: 4,
    label: 'I want to track my prediction streaks',
  },
  {
    level: 5,
    label: 'I want to dominate the global leaderboards',
  },
] as const

export type OnboardingMotivationLevel =
  (typeof ONBOARDING_MOTIVATION_LEVEL_OPTIONS)[number]['level']

export function isOnboardingMotivationLevel(
  value: unknown,
): value is OnboardingMotivationLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

export function parseOnboardingState(raw: unknown): OnboardingState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const obj = raw as Record<string, unknown>
  const step =
    typeof obj.step === 'string' &&
    (ONBOARDING_STEPS as readonly string[]).includes(obj.step)
      ? (obj.step as OnboardingStepId)
      : undefined
  const favorite_sports = Array.isArray(obj.favorite_sports)
    ? obj.favorite_sports.filter((s): s is string => typeof s === 'string')
    : undefined
  const username_draft =
    typeof obj.username_draft === 'string' && obj.username_draft.trim()
      ? obj.username_draft.trim()
      : undefined
  const display_name_draft =
    typeof obj.display_name_draft === 'string'
      ? obj.display_name_draft
      : undefined
  const referral_source =
    typeof obj.referral_source === 'string' &&
    isOnboardingReferralId(obj.referral_source)
      ? obj.referral_source
      : undefined
  const fan_level = isOnboardingFanLevel(obj.fan_level)
    ? obj.fan_level
    : undefined
  const motivation_level = isOnboardingMotivationLevel(obj.motivation_level)
    ? obj.motivation_level
    : undefined
  const avatar_touched =
    typeof obj.avatar_touched === 'boolean' ? obj.avatar_touched : undefined

  return {
    ...(step ? { step } : {}),
    ...(favorite_sports ? { favorite_sports } : {}),
    ...(username_draft !== undefined ? { username_draft } : {}),
    ...(display_name_draft !== undefined ? { display_name_draft } : {}),
    ...(referral_source ? { referral_source } : {}),
    ...(fan_level !== undefined ? { fan_level } : {}),
    ...(motivation_level !== undefined ? { motivation_level } : {}),
    ...(avatar_touched !== undefined ? { avatar_touched } : {}),
  }
}

export function resolveResumeStep(state: OnboardingState): OnboardingStepId {
  if (
    state.step &&
    (ONBOARDING_STEPS as readonly string[]).includes(state.step)
  ) {
    return state.step as OnboardingStepId
  }
  return 'welcome'
}

export function stepIndex(step: OnboardingStepId): number {
  return ONBOARDING_STEPS.indexOf(step)
}

export function nextStep(step: OnboardingStepId): OnboardingStepId | null {
  const i = stepIndex(step)
  if (i < 0 || i >= ONBOARDING_STEPS.length - 1) return null
  return ONBOARDING_STEPS[i + 1]!
}

export function previousStep(step: OnboardingStepId): OnboardingStepId | null {
  const i = stepIndex(step)
  if (i <= 0) return null
  return ONBOARDING_STEPS[i - 1]!
}

export const JOIN_POOL_HREF = '/discover'
export const CREATE_POOL_HREF = '/create'
export const EXPLORE_HREF = '/dashboard'
export const LOGIN_HREF = '/login'
