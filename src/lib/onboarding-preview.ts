import {
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from '@/src/lib/onboarding'

/**
 * Onboarding design preview:
 * - non-production: anyone (logged out or in)
 * - production: authenticated site admins only
 */
export function canUseOnboardingPreview(options: {
  isAdmin: boolean | null | undefined
}): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  return options.isAdmin === true
}

export function isOnboardingPreviewRequest(
  previewParam: string | null | undefined,
): boolean {
  return previewParam === '1' || previewParam === 'true'
}

/** Logged-out `/onboarding?preview=1` is allowed only outside production. */
export function isAnonymousOnboardingPreviewAllowed(
  previewParam: string | null | undefined,
): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    isOnboardingPreviewRequest(previewParam)
  )
}

export function parseOnboardingPreviewStep(
  raw: string | null | undefined,
): OnboardingStepId | undefined {
  if (!raw) return undefined
  return (ONBOARDING_STEPS as readonly string[]).includes(raw)
    ? (raw as OnboardingStepId)
    : undefined
}

export const ONBOARDING_PREVIEW_HREF = '/onboarding?preview=1'
