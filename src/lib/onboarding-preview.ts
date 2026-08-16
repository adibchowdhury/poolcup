import {
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from '@/src/lib/onboarding'

/**
 * Onboarding design preview is allowed for site admins always, and for any
 * logged-in user in non-production (local/staging design work).
 */
export function canUseOnboardingPreview(options: {
  isAdmin: boolean | null | undefined
}): boolean {
  if (options.isAdmin === true) return true
  return process.env.NODE_ENV !== 'production'
}

export function isOnboardingPreviewRequest(
  previewParam: string | null | undefined,
): boolean {
  return previewParam === '1' || previewParam === 'true'
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
