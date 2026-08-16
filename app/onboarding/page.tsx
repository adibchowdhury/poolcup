import { redirect } from 'next/navigation'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'
import { parseOnboardingState } from '@/src/lib/onboarding'
import {
  canUseOnboardingPreview,
  isOnboardingPreviewRequest,
  parseOnboardingPreviewStep,
} from '@/src/lib/onboarding-preview'
import { getSafeRedirectPath } from '@/src/lib/safe-redirect'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { ensureDefaultUsername } from '@/src/lib/username'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; preview?: string; step?: string }>
}) {
  const {
    next: nextParam,
    preview: previewParam,
    step: stepParam,
  } = await searchParams
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginNext = isOnboardingPreviewRequest(previewParam)
      ? '/onboarding?preview=1'
      : '/onboarding'
    redirect(`/login?next=${encodeURIComponent(loginNext)}`)
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select(
      'username, display_name, favorite_sports, avatar, custom_avatar_url, referral_source, fan_level, motivation_level, onboarding_completed, onboarding_state, is_admin',
    )
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('onboarding: failed to load profile', error.message)
  }

  const wantsPreview = isOnboardingPreviewRequest(previewParam)
  const previewAllowed = canUseOnboardingPreview({
    isAdmin: profile?.is_admin,
  })
  const preview = wantsPreview && previewAllowed

  if (wantsPreview && !previewAllowed) {
    redirect(getSafeRedirectPath(nextParam, '/dashboard'))
  }

  if (profile?.onboarding_completed === true && !preview) {
    redirect(getSafeRedirectPath(nextParam, '/dashboard'))
  }

  // Guarantee a default sports username before the profile step.
  const { username: ensuredUsername } = await ensureDefaultUsername(
    supabase,
    user.id,
  )

  const onboardingState = parseOnboardingState(profile?.onboarding_state)
  const favoriteSports = Array.isArray(profile?.favorite_sports)
    ? profile.favorite_sports.filter((s): s is string => typeof s === 'string')
    : []

  const nextPath = getSafeRedirectPath(nextParam, '/dashboard')
  const previewStep = preview
    ? parseOnboardingPreviewStep(stepParam)
    : undefined

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <OnboardingFlow
        bootstrap={{
          userId: user.id,
          username: ensuredUsername ?? profile?.username ?? null,
          displayName: profile?.display_name ?? null,
          favoriteSports,
          avatar: profile?.avatar ?? null,
          customAvatarUrl: profile?.custom_avatar_url ?? null,
          referralSource:
            typeof profile?.referral_source === 'string'
              ? profile.referral_source
              : null,
          fanLevel:
            typeof profile?.fan_level === 'number' ? profile.fan_level : null,
          motivationLevel:
            typeof profile?.motivation_level === 'number'
              ? profile.motivation_level
              : null,
          onboardingState,
          nextPath,
        }}
        preview={preview}
        previewStep={previewStep}
      />
    </div>
  )
}
