'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardGlassSurface } from '@/components/dashboard/dashboard-glass-surface'

/** Set to ~24h after deploy; banner auto-hides after this instant. */
export const SCORING_NOTICE_EXPIRES_AT = new Date('2026-06-17T21:00:00-05:00')

const DISMISS_STORAGE_KEY = 'poolcup_scoring_notice_dismissed_v2'

export function ScoringUpdateNoticeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Date.now() >= SCORING_NOTICE_EXPIRES_AT.getTime()) {
      return
    }

    if (localStorage.getItem(DISMISS_STORAGE_KEY) === '1') {
      return
    }

    setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) {
    return null
  }

  return (
    <DashboardGlassSurface
      rounded="lg"
      className="relative mb-6 border-l-4 border-l-primary px-4 py-3 pr-12 text-sm leading-relaxed sm:px-5 sm:py-3.5 sm:text-base"
      role="alert"
    >
      <p className="font-semibold text-foreground">Scoring update</p>
      <p className="mt-1 text-muted-foreground">
        Correctly predicting a draw now earns 3 points, more than a correct
        winner, and an exact score still earns 5. Your points have been updated
        automatically. Thanks for the feedback.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
        onClick={dismiss}
        aria-label="Dismiss scoring update notice"
      >
        <X className="h-4 w-4" />
      </Button>
    </DashboardGlassSurface>
  )
}
