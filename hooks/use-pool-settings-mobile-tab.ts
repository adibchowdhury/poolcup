'use client'

import { useEffect, useState } from 'react'
import { POOL_SETTINGS_DESKTOP_MQ } from '@/src/lib/pool-settings-nav'

/**
 * Reactive pool mobile/desktop split — same rule as `shouldUsePoolSettingsMobileTab()`.
 * Source of truth: `POOL_SETTINGS_DESKTOP_MQ` = `(min-width: 1024px)` (Tailwind `lg`).
 * Below lg → mobile (settings tab + upgrade sheet). lg+ → desktop routes.
 */
export function usePoolSettingsMobileTab(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(POOL_SETTINGS_DESKTOP_MQ)
    const sync = () => setIsMobile(!mql.matches)
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])

  return isMobile
}
