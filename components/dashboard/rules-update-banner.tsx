'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DashboardNoticeBanner } from '@/components/dashboard/dashboard-notice-banner'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'
import { trackEvent } from '@/src/lib/track'

export const RULES_BANNER_DISMISS_STORAGE_KEY = 'poolcup_banner_rules_dismissed'

const RULES_PAGE_HREF = DASHBOARD_TAB_HREFS['how-it-works']

type RulesUpdateBannerProps = {
  userId: string
}

export function RulesUpdateBanner({ userId }: RulesUpdateBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(RULES_BANNER_DISMISS_STORAGE_KEY) === '1') {
      return
    }

    setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(RULES_BANNER_DISMISS_STORAGE_KEY, '1')
    setVisible(false)
    trackEvent('banner_dismissed', {
      userId,
      metadata: { banner: 'rules_update' },
    })
  }

  function handleCtaClick() {
    trackEvent('banner_clicked', {
      userId,
      metadata: { banner: 'rules_update' },
    })
  }

  if (!visible) {
    return null
  }

  return (
    <DashboardNoticeBanner
      dismissible
      onDismiss={dismiss}
      dismissAriaLabel="Dismiss knockout scoring notice"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-white">
          Knockout scoring is bigger. Check your pool rules to see how points
          work for each stage.
        </p>
        <Button
          asChild
          size="sm"
          className="w-full shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          <Link href={RULES_PAGE_HREF} onClick={handleCtaClick}>
            View scoring rules
          </Link>
        </Button>
      </div>
    </DashboardNoticeBanner>
  )
}
