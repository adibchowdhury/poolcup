'use client'

import { useState } from 'react'
import { Megaphone, Pin, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PoolAnnouncement } from '@/src/lib/pool-announcements'
import { dismissPoolAnnouncement } from '@/src/lib/pool-announcements'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { supabase } from '@/src/lib/supabase'

type PoolAnnouncementBannerProps = {
  announcement: PoolAnnouncement
  onDismissed: (announcementId: string) => void
  className?: string
}

/**
 * Persistent pool announcement notice. Prefers the PINNED announcement
 * (passed from parent). Stays until the user dismisses; dismissal is per-user.
 */
export function PoolAnnouncementBanner({
  announcement,
  onDismissed,
  className,
}: PoolAnnouncementBannerProps) {
  const [dismissing, setDismissing] = useState(false)
  const pinned = Boolean(announcement.pinned)

  async function handleDismiss() {
    if (dismissing) return
    const id = announcement.id
    setDismissing(true)
    onDismissed(id)
    const result = await dismissPoolAnnouncement(supabase, id)
    if (!result.ok) {
      console.error('Failed to persist announcement dismissal:', result.error)
    }
    setDismissing(false)
  }

  return (
    <div
      role="status"
      className={cn(
        'relative overflow-hidden rounded-xl border',
        pinned
          ? 'border-primary/50 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent'
          : 'border-primary/35 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent',
        'px-3 py-3 sm:px-4',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary"
        aria-hidden
      />
      <div className="flex items-start gap-3 pl-1.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
          {pinned ? (
            <Pin className="h-4 w-4 text-primary" aria-hidden />
          ) : (
            <Megaphone className="h-4 w-4 text-primary" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {pinned ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Pinned announcement
            </p>
          ) : null}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {announcement.message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleDismiss()}
          disabled={dismissing}
          className={cn(
            'shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors',
            'hover:bg-primary/15 hover:text-foreground',
            FOCUS_VISIBLE_RING,
          )}
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
