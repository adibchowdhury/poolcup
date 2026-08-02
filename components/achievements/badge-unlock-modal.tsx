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
 * Mount: createPortal → document.body (single fixed root).
 * Centering: grid place-items-center on an inset-0 layer.
 * Scroll-lock: overflow:hidden on body only — never body padding-right
 * (that shifts fixed body-children and mis-centers on scrolling tabs).
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

function sizeCanvasToViewport(canvas: HTMLCanvasElement) {
  const w = window.innerWidth
  const h = window.innerHeight
  // Fill the fixed portal root — never leave the HTML 300×150 default.
  canvas.style.position = 'absolute'
  canvas.style.inset = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
}

export function BadgeUnlockModal({
  badge,
  onDismiss,
  remainingCount = 0,
}: BadgeUnlockModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [portalReady, setPortalReady] = useState(false)
  const [showRain, setShowRain] = useState(false)

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!badge) return

    // Scroll-lock only — do NOT pad body for the scrollbar. padding-right on
    // document.body shifts this fixed portal (a body child) and parks the
    // modal in the bottom-right on tall/scrolling tabs (Pool). Brief page
    // reflow when the scrollbar disappears is acceptable.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    if (canvasRef.current) {
      sizeCanvasToViewport(canvasRef.current)
    }

    // Dev-only sanity: portal root must be a direct child of document.body.
    if (
      process.env.NODE_ENV !== 'production' &&
      rootRef.current &&
      rootRef.current.parentElement !== document.body
    ) {
      console.warn(
        '[BadgeUnlockModal] portal root is not mounted on document.body',
        rootRef.current.parentElement,
      )
    }

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [badge])

  useEffect(() => {
    if (!badge || !canvasRef.current) return

    setShowRain(false)

    const canvas = canvasRef.current
    sizeCanvasToViewport(canvas)

    // resize:false — we own sizing via sizeCanvasToViewport + window resize.
    // resize:true races a rAF re-measure against our manual bitmap size (~snap).
    const fire = confetti.create(canvas, {
      resize: false,
      useWorker: false,
    })

    const onResize = () => sizeCanvasToViewport(canvas)
    window.addEventListener('resize', onResize)

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
      window.removeEventListener('resize', onResize)
    }
  }, [badge?.id, onDismiss])

  if (!badge || !portalReady) return null

  return createPortal(
    <div
      ref={rootRef}
      data-badge-unlock-root
      className="pointer-events-none fixed inset-0 z-[120]"
      // Viewport-fixed — measured from the viewport, not body padding box.
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 'auto',
        height: 'auto',
      }}
    >
      {/* Backdrop */}
      <div
        className="pointer-events-auto absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onDismiss}
        aria-hidden
      />

      {/* Confetti burst — bitmap sized to innerWidth/innerHeight; CSS fills root */}
      <canvas
        ref={canvasRef}
        data-badge-unlock-canvas
        className="pointer-events-none absolute inset-0 z-[1]"
        width={1920}
        height={1080}
        aria-hidden
      />

      {/* Continuous gentle rain — homepage hero effect */}
      {showRain ? (
        <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
          <HeroConfetti />
        </div>
      ) : null}

      <button
        type="button"
        onClick={onDismiss}
        className="pointer-events-auto absolute right-4 top-4 z-[4] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-background/70 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        aria-label="Close"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      {/*
        Content — absolute inset-0 + grid center (no translate-based centering).
        Lives under the body-portaled root so Pool-tab filters/transforms cannot
        become its containing block.
      */}
      <div
        className="pointer-events-none absolute inset-0 z-[3] grid place-items-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-unlock-title"
        aria-describedby="badge-unlock-subtitle"
      >
        <div
          data-badge-unlock-content
          className="pointer-events-auto w-full max-w-sm text-center"
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
      </div>
    </div>,
    document.body,
  )
}
