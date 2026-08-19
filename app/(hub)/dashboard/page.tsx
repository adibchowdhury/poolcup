import { redirect } from 'next/navigation'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { resolveUserDisplayName } from '@/src/lib/auth'
import { getHubAuth, getHubProfile } from '@/src/lib/hub-session'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordReset?: string }>
}) {
  const { passwordReset } = await searchParams
  const { user } = await getHubAuth()

  if (!user) {
    redirect('/login')
  }

  const profile = await getHubProfile(user.id)
  const favoriteSports = Array.isArray(profile?.favorite_sports)
    ? profile.favorite_sports.filter((s): s is string => typeof s === 'string')
    : []

  return (
    <DashboardView
      userId={user.id}
      email={user.email ?? ''}
      displayName={resolveUserDisplayName(
        profile?.display_name,
        user.user_metadata,
      )}
      username={profile?.username ?? null}
      avatar={profile?.avatar ?? null}
      customAvatarUrl={profile?.custom_avatar_url ?? null}
      createdAt={profile?.created_at ?? null}
      supportPromptLastShownAt={profile?.support_prompt_last_shown_at ?? null}
      favoriteSports={favoriteSports}
      quickStats={{
        totalPoints: profile?.points ?? 0,
        predictionsMade: 0,
        winRate: null,
      }}
      passwordResetSuccess={passwordReset === 'success'}
      errorMessage={null}
    />
  )
}
