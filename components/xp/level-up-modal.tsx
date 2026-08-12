'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'
import { X } from 'lucide-react'
import { HeroConfetti } from '@/components/landing/hero-confetti'
import { Button } from '@/components/ui/button'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

type LevelUpModalProps = {
  level: number | null
  onDismiss: () => void
}

const CONFETTI_COLORS = ['#00e676', '#ffb300', '#f0f4f8', '#34d399']

function fireBurst(fire: confetti.CreateTypes) {
  void fire({
    particleCount: 80,
    spread: 70,
    startVelocity: 34,
    origin: { x: 0.5, y: 0.32 },
    colors: CONFETTI_COLORS,
    ticks: 90,
    disableForReducedMotion: true,
  })
}

export function LevelUpModal({ level, onDismiss }: LevelUpModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [portalReady, setPortalReady] = useState(false)
  const [showRain, setShowRain] = useState(false)

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!level || !canvasRef.current) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const canvas = canvasRef.current
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const fire = confetti.create(canvas, { resize: false, useWorker: false })
    fireBurst(fire)
    const rainTimer = window.setTimeout(() => setShowRain(true), 500)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.clearTimeout(rainTimer)
      fire.reset()
      window.removeEventListener('keydown', onKeyDown)
      setShowRain(false)
    }
  }, [level, onDismiss])

  if (!level || !portalReady) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[120]">
      <div
        className="pointer-events-auto absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onDismiss}
        aria-hidden
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden
      />
      {showRain ? (
        <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
          <HeroConfetti />
        </div>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          'pointer-events-auto absolute right-4 top-4 z-[4] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-background/70 text-muted-foreground',
          FOCUS_VISIBLE_RING,
        )}
        aria-label="Close"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <div
        className="pointer-events-none absolute inset-0 z-[3] grid place-items-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-title"
      >
        <div className="pointer-events-auto w-full max-w-sm text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Level up
          </p>
          <p
            id="level-up-title"
            className="mt-4 font-display text-6xl tabular-nums tracking-wide text-foreground"
          >
            {level}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            You reached a new PoolCup level.
          </p>
          <Button
            type="button"
            className={cn('mt-8 min-w-[10rem]', FOCUS_VISIBLE_RING)}
            onClick={onDismiss}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
