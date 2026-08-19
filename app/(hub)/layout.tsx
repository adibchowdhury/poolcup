import type { ReactNode } from 'react'
import { DashboardAppShell } from '@/components/dashboard/dashboard-app-shell'
import { HubChromeProfileProvider } from '@/components/dashboard/hub-chrome-profile'
import { HubLayoutMarker } from '@/components/dashboard/hub-layout-context'
import { resolveUserDisplayName } from '@/src/lib/auth'
import { getHubAuth, getHubProfile } from '@/src/lib/hub-session'

export default async function HubLayout({
  children,
}: {
  children: ReactNode
}) {
  const { user } = await getHubAuth()
  if (!user) {
    return children
  }

  const profile = await getHubProfile(user.id)
  const displayName =
    resolveUserDisplayName(profile?.display_name, user.user_metadata) ?? ''

  return (
    <HubChromeProfileProvider
      initial={{
        displayName,
        avatar: profile?.avatar ?? null,
        customAvatarUrl: profile?.custom_avatar_url ?? null,
      }}
    >
      <DashboardAppShell
        userId={user.id}
        email={user.email ?? ''}
        displayName={displayName}
        avatar={profile?.avatar ?? null}
        customAvatarUrl={profile?.custom_avatar_url ?? null}
        forceHubNav
      >
        <HubLayoutMarker>{children}</HubLayoutMarker>
      </DashboardAppShell>
    </HubChromeProfileProvider>
  )
}
