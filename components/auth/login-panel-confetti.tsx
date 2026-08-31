'use client'

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/utils'

/**
 * Continuous slow rain via canvas-confetti (same library as pool-creation).
 *
 * density:
 * - normal (ambient): full-width drift; login back layer / leaderboard periphery
 * - dense (podium zone): ~2.5× ambient cadence — pair with originXRange over winners
 * - sparse (front layer): podium overlay only
 *
 * useWorker: false — OffscreenCanvas blocked ResizeObserver canvas resizes.
 */
export const EMIT_INTERVAL_MS = { normal: 220, dense: 88, sparse: 520 } as const

/**
 * Horizontal band (0–1) covering the three podium pedestals on the stadium card.
 * Used by the dense second emitter so celebration centers on the winners.
 */
export const LEADERBOARD_PODIUM_CONFETTI_X_RANGE = {
  min: 0.22,
  max: 0.78,
} as const

/** Login-only festive palette. */
const LOGIN_CONFETTI_COLORS = [
  '#00E887',
  '#F2C94C',
  '#FFFFFF',
  '#38BDF8',
  '#FF7A59',
] as const

/** Cross-seam bleed onto left panel (px). Keeps bulk on the right; stays clear of form. */
export const LOGIN_CONFETTI_BLEED_LEFT_PX = 48

function sizeCanvasToHost(canvas: HTMLCanvasElement, host: HTMLElement) {
  const w = Math.max(1, Math.floor(host.clientWidth))
  const h = Math.max(1, Math.floor(host.clientHeight))
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min
}

type LoginPanelConfettiProps = {
  density?: keyof typeof EMIT_INTERVAL_MS
  className?: string
  /**
   * When > 0, host spans right panel + this many px into the left.
   * Emit origin is biased so only a thin reduced-density band uses the bleed.
   */
  bleedLeftPx?: number
  /**
   * When set, every emit's origin.x is uniform in [min, max] (0–1).
   * Used for a second podium-zone emitter; ignored bleed horizontal bias.
   */
  originXRange?: { min: number; max: number }
}

export function LoginPanelConfetti({
  density = 'normal',
  className,
  bleedLeftPx = 0,
  originXRange,
}: LoginPanelConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sparse = density === 'sparse'
  const originMin = originXRange?.min
  const originMax = originXRange?.max

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) return

    sizeCanvasToHost(canvas, host)
    const fire = confetti.create(canvas, {
      resize: false,
      useWorker: false,
    })

    let intervalId: number | null = null
    const intervalMs = EMIT_INTERVAL_MS[density]
    const useOriginBand =
      typeof originMin === 'number' &&
      typeof originMax === 'number' &&
      originMax > originMin

    const emit = () => {
      if (document.visibilityState === 'hidden') return
      const color =
        LOGIN_CONFETTI_COLORS[
          Math.floor(Math.random() * LOGIN_CONFETTI_COLORS.length)
        ]
      const ticks = sparse
        ? Math.max(280, Math.ceil(canvas.height * 1.4))
        : Math.max(520, Math.ceil(canvas.height * 1.5))

      let originX: number
      let isBleedParticle = false

      if (useOriginBand) {
        originX = randomInRange(originMin, originMax)
      } else {
        const bleedFrac =
          !sparse && bleedLeftPx > 0 && canvas.width > 0
            ? Math.min(0.35, bleedLeftPx / canvas.width)
            : 0
        // ~14% of back-layer emits land in the narrow bleed band; bulk stays right.
        originX =
          bleedFrac > 0 && Math.random() < 0.14
            ? Math.random() * bleedFrac
            : bleedFrac + Math.random() * (1 - bleedFrac)
        isBleedParticle = bleedFrac > 0 && originX < bleedFrac
      }

      void fire({
        particleCount: sparse
          ? 1
          : isBleedParticle
            ? 1
            : Math.random() < 0.55
              ? 1
              : 2,
        startVelocity: 0,
        gravity: sparse ? 0.85 : 0.8,
        drift: randomInRange(-0.35, 0.35),
        ticks,
        scalar: sparse
          ? randomInRange(0.4, 0.65)
          : isBleedParticle
            ? randomInRange(0.35, 0.55)
            : randomInRange(0.55, 0.85),
        spread: 360,
        origin: { x: originX, y: -0.05 },
        colors: [color],
        disableForReducedMotion: true,
      })
    }

    const startLoop = () => {
      if (intervalId != null) return
      emit()
      intervalId = window.setInterval(emit, intervalMs)
    }

    const stopLoop = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
      fire.reset()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopLoop()
      } else if (!reduced.matches) {
        startLoop()
      }
    }

    const onResize = () => sizeCanvasToHost(canvas, host)
    const ro = new ResizeObserver(onResize)
    ro.observe(host)
    document.addEventListener('visibilitychange', onVisibility)

    startLoop()

    return () => {
      stopLoop()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [density, sparse, bleedLeftPx, originMin, originMax])

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        className,
      )}
      aria-hidden
    />
  )
}
