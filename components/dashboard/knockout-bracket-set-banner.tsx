'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DashboardNoticeBanner } from '@/components/dashboard/dashboard-notice-banner'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'
import { trackEvent } from '@/src/lib/track'

/** Last R32 kickoff — extend if the banner should run through the round. */
export const KNOCKOUT_BANNER_EXPIRES_AT = new Date('2026-07-03T19:00:00Z')

export const KNOCKOUT_BANNER_DISMISS_STORAGE_KEY =
  'poolcup_banner_knockout_set_dismissed'

const POOLS_TAB_HREF = DASHBOARD_TAB_HREFS.dashboard

type KnockoutBracketSetBannerProps = {
  userId: string
}

export function KnockoutBracketSetBanner({ userId }: KnockoutBracketSetBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Date.now() >= KNOCKOUT_BANNER_EXPIRES_AT.getTime()) {
      return
    }

    if (localStorage.getItem(KNOCKOUT_BANNER_DISMISS_STORAGE_KEY) === '1') {
      return
    }

    setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(KNOCKOUT_BANNER_DISMISS_STORAGE_KEY, '1')
    setVisible(false)
    trackEvent('banner_dismissed', {
      userId,
      metadata: { banner: 'knockout_set' },
    })
  }

  function handleCtaClick() {
    trackEvent('banner_clicked', {
      userId,
      metadata: { banner: 'knockout_set' },
    })
  }

  if (!visible) {
    return null
  }

  return (
    <DashboardNoticeBanner
      dismissible
      onDismiss={dismiss}
      dismissAriaLabel="Dismiss knockout bracket notice"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-white">
          The group stage is done, and the world cup knockout bracket is set with
          the 32 teams. Make your predictions before the first match on Jun 28.
        </p>
        <Button
          asChild
          size="sm"
          className="w-full shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          <Link href={POOLS_TAB_HREF} onClick={handleCtaClick}>
            Make predictions
          </Link>
        </Button>
      </div>
    </DashboardNoticeBanner>
  )
}
