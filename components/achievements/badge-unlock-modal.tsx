'use client'

import { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'
import { X } from 'lucide-react'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { HeroConfetti } from '@/components/landing/hero-confetti'
import { Button } from '@/components/ui/button'

export type BadgeUnlockItem = {
  id: string
  name: string
  xp_value: number
}

type BadgeUnlockModalProps = {
  badge: BadgeUnlockItem | null
  onDismiss: () => void
  /** Remaining badges after the current one (for "1 of N" style hints). */
  remainingCount?: number
}

const CONFETTI_COLORS = ['#00e676', '#ffb300', '#f0f4f8', '#34d399']
/** Brief celebratory pop, then hand off to the hero-style continuous rain. */
const INITIAL_BURST_MS = 550

/**
 * Root cause of the bottom-right → center snap (previous attempts missed this):
 *
 * 1) `animate-in zoom-in-95 fade-in` ran an enter transform on the badge
 *    (`scale` via tw-animate `enter` keyframes). That made the celebration
 *    read as growing from an off-center first paint into place.
 * 2) `canvas-confetti` with `useWorker: true` calls `transferControlToOffscreen`
 *    on the modal canvas and sets large `canvas.width`/`height` bitmaps. During
 *    worker init (~1s), that canvas can disrupt layout next to flex-centered
 *    content, so the block appears anchored bottom-right until the worker
 *    settles and layout recalculates to center.
 *
 * Fix: portal to `document.body`, center with absolute `left/top 50%` +
 * translate (no flex, no enter animation), confetti on a non-worker canvas
 * that never participates in document/flex layout.
 */
function fireShortBurst(fire: confetti.CreateTypes) {
  void fire({
    particleCount: 70,
    spread: 68,
    startVelocity: 32,
    origin: { x: 0.5, y: 0.3 },
    colors: CONFETTI_COLORS,
    ticks: 90,
    disableForReducedMotion: true,
  })
  window.setTimeout(() => {
    void fire({
      particleCount: 28,
      angle: 60,
      spread: 48,
      startVelocity: 26,
      origin: { x: 0.15, y: 0.45 },
      colors: CONFETTI_COLORS,
      ticks: 80,
      disableForReducedMotion: true,
    })
    void fire({
      particleCount: 28,
      angle: 120,
      spread: 48,
      startVelocity: 26,
      origin: { x: 0.85, y: 0.45 },
      colors: CONFETTI_COLORS,
      ticks: 80,
      disableForReducedMotion: true,
    })
  }, 120)
}

export function BadgeUnlockModal({
  badge,
  onDismiss,
  remainingCount = 0,
}: BadgeUnlockModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [portalReady, setPortalReady] = useState(false)
  const [showRain, setShowRain] = useState(false)

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!badge) return

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [badge])

  useEffect(() => {
    if (!badge || !canvasRef.current) return

    setShowRain(false)

    const canvas = canvasRef.current
    // Keep CSS box = overlay; never let bitmap size affect layout.
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none'

    // useWorker:false — OffscreenCanvas transfer was contributing to the layout snap.
    const fire = confetti.create(canvas, {
      resize: true,
      useWorker: false,
    })

    fireShortBurst(fire)

    const rainTimer = window.setTimeout(() => {
      setShowRain(true)
    }, INITIAL_BURST_MS)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(rainTimer)
      fire.reset()
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [badge?.id, onDismiss])

  if (!badge || !portalReady) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-unlock-title"
      aria-describedby="badge-unlock-subtitle"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onDismiss}
        aria-hidden
      />

      {/* Burst canvas — absolute overlay only; not a flex/layout participant */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-20"
        aria-hidden
      />

      {/* Continuous gentle rain — same effect as the homepage hero */}
      {showRain ? (
        <HeroConfetti className="z-[15]" />
      ) : null}

      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-background/70 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        aria-label="Close"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      {/*
        Center from first paint via absolute + translate — no flex centering,
        no enter/zoom animation that can read as an off-center start.
      */}
      <div
        className="absolute left-1/2 top-1/2 z-10 w-[min(100%,24rem)] -translate-x-1/2 -translate-y-1/2 px-4 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          Congratulations!
        </p>

        <div className="relative mx-auto mt-6 h-40 w-40 sm:h-48 sm:w-48">
          <div
            className="pointer-events-none absolute inset-[-18%] rounded-full bg-primary/25 blur-3xl"
            aria-hidden
          />
          <div className="relative h-full w-full drop-shadow-[0_0_28px_rgba(0,230,118,0.35)]">
            <AchievementBadgeArt achievementId={badge.id} />
          </div>
        </div>

        <h2
          id="badge-unlock-title"
          className="mt-6 font-display text-3xl tracking-wide text-foreground sm:text-4xl"
        >
          {badge.name}
        </h2>
        <p
          id="badge-unlock-subtitle"
          className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary"
        >
          New Badge!
        </p>
        {badge.xp_value > 0 ? (
          <p className="mt-2 text-sm tabular-nums text-primary/85">
            +{badge.xp_value} XP
          </p>
        ) : null}

        <Button
          type="button"
          className="mt-8 min-w-[10rem] bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onDismiss}
        >
          {remainingCount > 0 ? 'Next badge' : 'Continue'}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
