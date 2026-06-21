'use client'

import { useEffect, useRef, useState } from 'react'

/** Current image stays fully visible before the next wipe begins. */
export const HERO_BACKGROUND_HOLD_DURATION_MS = 3500

/** Fast vertical divider sweep from right edge to left edge. */
export const HERO_BACKGROUND_WIPE_DURATION_MS = 450

export const HERO_BACKGROUND_IMAGES = [
  '/background_01.png',
  '/background_02.png',
  '/background_03.png',
] as const

const imageStyle = {
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
} as const

type CarouselPhase = 'hold' | 'wipe'

export function HeroBackgroundCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [clipLeftPercent, setClipLeftPercent] = useState(100)
  const [showDivider, setShowDivider] = useState(false)

  const imageCount = HERO_BACKGROUND_IMAGES.length
  const nextIndex = (currentIndex + 1) % imageCount

  const phaseRef = useRef<CarouselPhase>('hold')

  useEffect(() => {
    let rafId = 0
    let phaseStartMs = 0
    let hiddenStartMs = 0
    let totalHiddenMs = 0

    const tick = (now: number) => {
      if (document.hidden) {
        if (hiddenStartMs === 0) {
          hiddenStartMs = now
        }
        rafId = window.requestAnimationFrame(tick)
        return
      }

      if (hiddenStartMs !== 0) {
        totalHiddenMs += now - hiddenStartMs
        hiddenStartMs = 0
      }

      if (phaseStartMs === 0) {
        phaseStartMs = now
      }

      const elapsed = now - phaseStartMs - totalHiddenMs

      if (phaseRef.current === 'hold') {
        if (elapsed >= HERO_BACKGROUND_HOLD_DURATION_MS) {
          phaseRef.current = 'wipe'
          phaseStartMs = now
          totalHiddenMs = 0
          setShowDivider(true)
        }
      } else {
        const progress = Math.min(elapsed / HERO_BACKGROUND_WIPE_DURATION_MS, 1)
        setClipLeftPercent(100 - progress * 100)

        if (progress >= 1) {
          setCurrentIndex((index) => (index + 1) % imageCount)
          setClipLeftPercent(100)
          setShowDivider(false)
          phaseRef.current = 'hold'
          phaseStartMs = now
          totalHiddenMs = 0
        }
      }

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [imageCount])

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          ...imageStyle,
          backgroundImage: `url('${HERO_BACKGROUND_IMAGES[currentIndex]}')`,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          ...imageStyle,
          backgroundImage: `url('${HERO_BACKGROUND_IMAGES[nextIndex]}')`,
          clipPath: `inset(0 0 0 ${clipLeftPercent}%)`,
          willChange: 'clip-path',
        }}
      />

      {showDivider ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-[1] -translate-x-1/2"
          style={{ left: `${clipLeftPercent}%` }}
        >
          <div className="relative h-full w-px bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.45)]">
            <div
              className="absolute top-1/2 left-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95 shadow-[0_0_10px_rgba(255,255,255,0.35)]"
              aria-hidden
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
