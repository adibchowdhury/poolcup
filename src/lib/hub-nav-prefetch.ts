'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  DASHBOARD_TAB_HREFS,
  DISCOVER_HREF,
  FRIENDS_HREF,
} from '@/src/lib/mobile-bottom-nav-routes'

export const HUB_NAV_PREFETCH_HREFS = [
  DASHBOARD_TAB_HREFS.dashboard,
  DASHBOARD_TAB_HREFS.upcoming,
  DASHBOARD_TAB_HREFS.profile,
  FRIENDS_HREF,
  DISCOVER_HREF,
] as const

export function usePrefetchHubRoutes() {
  const router = useRouter()

  useEffect(() => {
    for (const href of HUB_NAV_PREFETCH_HREFS) {
      router.prefetch(href)
    }
  }, [router])
}
