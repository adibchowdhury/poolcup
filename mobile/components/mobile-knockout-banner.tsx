'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/** Last R32 kickoff — extend if the banner should run through the round. */
export const KNOCKOUT_BANNER_EXPIRES_AT = new Date('2026-07-03T19:00:00Z')

export const KNOCKOUT_BANNER_DISMISS_STORAGE_KEY =
  'poolcup_banner_knockout_set_dismissed'

const NOTICE_CLASS =
  'relative rounded-lg border border-border/80 border-l-4 border-l-white/20 bg-card/80 px-4 py-3 pr-12 text-sm leading-relaxed'

type MobileKnockoutBannerProps = {
  onStubAction: () => void
}

export function MobileKnockoutBanner({ onStubAction }: MobileKnockoutBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (Date.now() >= KNOCKOUT_BANNER_EXPIRES_AT.getTime()) return
    if (localStorage.getItem(KNOCKOUT_BANNER_DISMISS_STORAGE_KEY) === '1') return
    setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(KNOCKOUT_BANNER_DISMISS_STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={NOTICE_CLASS} role="status">
      <div className="flex flex-col gap-3">
        <p className="text-white">
          The group stage is done, and the world cup knockout bracket is set with
          the 32 teams. Make your predictions before the first match on Jun 28.
        </p>
        <button
          type="button"
          onClick={onStubAction}
          className="w-full shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Make predictions
        </button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
        aria-label="Dismiss knockout bracket notice"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
