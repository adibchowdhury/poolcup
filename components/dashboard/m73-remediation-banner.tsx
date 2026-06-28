'use client'

import { useEffect, useState } from 'react'
import { DashboardNoticeBanner } from '@/components/dashboard/dashboard-notice-banner'
import { trackEvent } from '@/src/lib/track'

export const M73_REMEDIATION_BANNER_EXPIRES_AT = new Date('2026-07-02T00:00:00Z')

export const M73_REMEDIATION_BANNER_DISMISS_STORAGE_KEY =
  'poolcup_banner_m73_remediation_dismissed'

type M73RemediationBannerProps = {
  userId: string
}

export function M73RemediationBanner({ userId }: M73RemediationBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Date.now() >= M73_REMEDIATION_BANNER_EXPIRES_AT.getTime()) {
      return
    }

    if (localStorage.getItem(M73_REMEDIATION_BANNER_DISMISS_STORAGE_KEY) === '1') {
      return
    }

    setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(M73_REMEDIATION_BANNER_DISMISS_STORAGE_KEY, '1')
    setVisible(false)
    trackEvent('banner_dismissed', {
      userId,
      metadata: { banner: 'm73_remediation' },
    })
  }

  if (!visible) {
    return null
  }

  return (
    <DashboardNoticeBanner
      dismissible
      onDismiss={dismiss}
      dismissAriaLabel="Dismiss M73 remediation notice"
    >
      <p className="text-white">
        Due to a saving bug affecting some Round of 32 predictions, everyone will
        receive equal points for the Canada vs South Africa match. Your other
        predictions are unaffected.
      </p>
    </DashboardNoticeBanner>
  )
}
