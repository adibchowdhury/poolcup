export const ONBOARDING_STEPS = [
  'value_prop',
  'favorite_sports',
  'username',
  'avatar',
  'join_discover',
  'first_prediction',
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]

export type OnboardingState = {
  step?: OnboardingStepId | string
  favorite_sports?: string[]
  username_draft?: string
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

export function parseOnboardingState(
  raw: unknown,
): OnboardingState {
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
    typeof obj.username_draft === 'string' ? obj.username_draft : undefined
  const avatar_touched =
    typeof obj.avatar_touched === 'boolean' ? obj.avatar_touched : undefined

  return {
    ...(step ? { step } : {}),
    ...(favorite_sports ? { favorite_sports } : {}),
    ...(username_draft !== undefined ? { username_draft } : {}),
    ...(avatar_touched !== undefined ? { avatar_touched } : {}),
  }
}

export function resolveResumeStep(
  state: OnboardingState,
): OnboardingStepId {
  if (
    state.step &&
    (ONBOARDING_STEPS as readonly string[]).includes(state.step)
  ) {
    return state.step as OnboardingStepId
  }
  return 'value_prop'
}

export function stepIndex(step: OnboardingStepId): number {
  return ONBOARDING_STEPS.indexOf(step)
}

export function nextStep(
  step: OnboardingStepId,
): OnboardingStepId | null {
  const i = stepIndex(step)
  if (i < 0 || i >= ONBOARDING_STEPS.length - 1) return null
  return ONBOARDING_STEPS[i + 1]!
}

export const DISCOVER_POOLS_HREF = '/dashboard?tab=dashboard'
export const FIRST_PREDICTION_HREF = '/dashboard?tab=upcoming'
