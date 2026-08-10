import { redirect } from 'next/navigation'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'
import { parseOnboardingState } from '@/src/lib/onboarding'
import { getSafeRedirectPath } from '@/src/lib/safe-redirect'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { ensureDefaultUsername } from '@/src/lib/username'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next: nextParam } = await searchParams
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/onboarding')
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select(
      'username, favorite_sports, avatar, custom_avatar_url, onboarding_completed, onboarding_state',
    )
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('onboarding: failed to load profile', error.message)
  }

  if (profile?.onboarding_completed === true) {
    redirect(getSafeRedirectPath(nextParam, '/dashboard'))
  }

  // Guarantee a default sports username before the username step.
  const { username: ensuredUsername } = await ensureDefaultUsername(
    supabase,
    user.id,
  )

  const onboardingState = parseOnboardingState(profile?.onboarding_state)
  const favoriteSports = Array.isArray(profile?.favorite_sports)
    ? profile.favorite_sports.filter((s): s is string => typeof s === 'string')
    : []

  const nextPath = getSafeRedirectPath(nextParam, '/dashboard')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OnboardingFlow
        bootstrap={{
          userId: user.id,
          username: ensuredUsername ?? profile?.username ?? null,
          favoriteSports,
          avatar: profile?.avatar ?? null,
          customAvatarUrl: profile?.custom_avatar_url ?? null,
          onboardingState,
          nextPath,
        }}
      />
    </div>
  )
}
