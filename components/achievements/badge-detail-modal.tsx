'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Lock, X } from 'lucide-react'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { Button } from '@/components/ui/button'
import {
  formatAchievementEarnedDate,
  getAchievementUiState,
} from '@/src/lib/achievement-catalogue-layout'
import {
  achievementRarityLabel,
  ACHIEVEMENT_RARITY_STYLES,
} from '@/src/lib/achievement-rarity'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import type {
  AchievementWithStatus,
  UserAchievementProgress,
} from '@/src/lib/fetch-user-achievements'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

type BadgeDetailModalProps = {
  badge: AchievementWithStatus | null
  progress: UserAchievementProgress | null
  onDismiss: () => void
}

function focusableSelector(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
}

export function BadgeDetailModal({
  badge,
  progress,
  onDismiss,
}: BadgeDetailModalProps) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!badge) return

    capturePostHog('badge_detail_opened', {
      achievement_id: badge.id,
      rarity: normalizeForAnalytics(badge.rarity),
    })

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const previousActive = document.activeElement as HTMLElement | null
    window.setTimeout(() => closeRef.current?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const nodes = focusableSelector(panelRef.current)
      if (nodes.length === 0) return
      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previousActive?.focus?.()
    }
  }, [badge, onDismiss])

  if (!badge || typeof document === 'undefined') return null

  const state = getAchievementUiState(badge)
  const rarity = achievementRarityLabel(badge.rarity)
  const rarityStyle = ACHIEVEMENT_RARITY_STYLES[rarity]
  const current = Math.min(
    progress?.current_value ?? 0,
    progress?.threshold ?? badge.threshold,
  )
  const threshold = progress?.threshold ?? badge.threshold
  const progressPct = progress
    ? Math.min(100, Math.max(0, progress.progress_pct))
    : threshold > 0
      ? Math.min(100, Math.round((current / threshold) * 100))
      : 0

  return createPortal(
    <div className="fixed inset-0 z-[110]">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden
      />
      <div className="absolute inset-0 grid place-items-center px-4 py-8">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className={cn(
            'pointer-events-auto relative w-full max-w-sm rounded-2xl border bg-card p-5 shadow-none',
            rarityStyle.border,
          )}
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onDismiss}
            className={cn(
              'absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground',
              FOCUS_VISIBLE_RING,
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>

          <div className="mx-auto h-28 w-28">
            <div
              className={cn(
                'h-full w-full',
                state !== 'earned' && 'opacity-55 grayscale',
              )}
            >
              <AchievementBadgeArt
                achievementId={badge.id}
                artFilename={badge.art_filename}
                src={badge.imageUrl}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]',
                rarityStyle.chip,
              )}
            >
              {rarity}
            </span>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-primary">
              +{badge.xp_value} XP
            </span>
            {state === 'locked' ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden />
                Locked
              </span>
            ) : null}
            {state === 'coming_soon' ? (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Coming soon
              </span>
            ) : null}
          </div>

          <h2
            id={titleId}
            className="mt-4 text-center font-display text-3xl tracking-wide text-foreground"
          >
            {badge.name}
          </h2>
          <p
            id={descId}
            className="mt-2 text-center text-sm leading-relaxed text-muted-foreground"
          >
            {badge.description}
          </p>

          {state === 'earned' ? (
            <p className="mt-4 text-center text-sm font-medium text-primary">
              Unlocked {formatAchievementEarnedDate(badge.earned_at)}
            </p>
          ) : state === 'coming_soon' ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              This badge isn&apos;t awardable yet — check back later.
            </p>
          ) : (
            <div className="mt-4 space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3">
              <p className="text-center text-xs text-muted-foreground">
                {badge.description}
              </p>
              {threshold > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
                    <span>
                      {current.toLocaleString()}/{threshold.toLocaleString()}
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', rarityStyle.bar)}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </>
              ) : null}
            </div>
          )}

          <Button
            type="button"
            className={cn('mt-6 w-full', FOCUS_VISIBLE_RING)}
            onClick={onDismiss}
          >
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function normalizeForAnalytics(value: string | null | undefined): string {
  return (value ?? 'common').trim().toLowerCase() || 'common'
}
