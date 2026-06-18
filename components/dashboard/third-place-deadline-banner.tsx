'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DashboardNoticeBanner } from '@/components/dashboard/dashboard-notice-banner'
import {
  fetchWinnerPoolsNeedingThirdPlace,
  resolveThirdPlaceDeadlineHref,
  THIRD_PLACE_DEADLINE_LABEL,
  type WinnerPoolNeedingThirdPlace,
} from '@/src/lib/third-place-deadline'
import { trackEvent } from '@/src/lib/track'
import { supabase } from '@/src/lib/supabase'

type ThirdPlaceDeadlineBannerProps = {
  userId: string
}

export function ThirdPlaceDeadlineBanner({ userId }: ThirdPlaceDeadlineBannerProps) {
  const [pools, setPools] = useState<WinnerPoolNeedingThirdPlace[] | null>(null)

  const loadPools = useCallback(async () => {
    const rows = await fetchWinnerPoolsNeedingThirdPlace(supabase, userId)
    setPools(rows)
  }, [userId])

  useEffect(() => {
    void loadPools()
  }, [loadPools])

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === 'visible') {
        void loadPools()
      }
    }

    window.addEventListener('focus', handleVisible)
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      window.removeEventListener('focus', handleVisible)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [loadPools])

  if (pools === null || pools.length === 0) {
    return null
  }

  const href = resolveThirdPlaceDeadlineHref(pools)
  if (!href) {
    return null
  }

  function handleCtaClick() {
    trackEvent('banner_clicked', {
      userId,
      metadata: { banner: 'third_place_deadline' },
    })
  }

  return (
    <DashboardNoticeBanner>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-white">
          Rank your best third-place teams before{' '}
          <span className="font-semibold text-primary">{THIRD_PLACE_DEADLINE_LABEL}</span>{' '}
          to lock in your knockout points.
          {pools.length > 1 ? (
            <span className="mt-1 block text-xs text-muted-foreground sm:mt-0 sm:inline sm:pl-1">
              ({pools.length} winner pools still need rankings)
            </span>
          ) : null}
        </p>
        <Button
          asChild
          size="sm"
          className="w-full shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          <Link href={href} onClick={handleCtaClick}>
            Rank third-place teams
          </Link>
        </Button>
      </div>
    </DashboardNoticeBanner>
  )
}
