'use client'

import { usePathname } from 'next/navigation'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { useAuth } from '@/src/lib/auth-context'
import { isAuthenticatedAppPath } from '@/src/lib/authenticated-paths'

export function AuthenticatedChrome() {
  const { user, loading } = useAuth()
  const pathname = usePathname() ?? ''

  if (loading || !user || !isAuthenticatedAppPath(pathname)) {
    return null
  }

  return <MobileBottomNav />
}
