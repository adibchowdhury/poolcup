'use client'

import { usePathname } from 'next/navigation'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { PushNudgeHost } from '@/components/push/push-nudge-host'
import { useAuth } from '@/src/lib/auth-context'
import { isAuthenticatedAppPath } from '@/src/lib/authenticated-paths'

export function AuthenticatedChrome() {
  const { user, loading } = useAuth()
  const pathname = usePathname() ?? ''

  // Pathname-only mount gate so server + client trees match on hydration.
  // Auth readiness is passed into the nav (visibility), not used to omit Suspense/nav.
  if (!isAuthenticatedAppPath(pathname)) {
    return null
  }

  const authReady = !loading && Boolean(user)

  return (
    <>
      <MobileBottomNav authReady={authReady} />
      {authReady ? <PushNudgeHost /> : null}
    </>
  )
}
