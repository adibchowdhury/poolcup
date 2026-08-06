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

/**
 * Hero background carousel.
 * Hold uses setTimeout (no rAF). Wipe uses rAF only for ~450ms and writes
 * clip-path via DOM refs (no React setState per frame). Idle = zero rAF.
 */
export function HeroBackgroundCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [wiping, setWiping] = useState(false)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const wipeLayerRef = useRef<HTMLDivElement | null>(null)
  const dividerRef = useRef<HTMLDivElement | null>(null)
  const currentIndexRef = useRef(0)
  const inViewRef = useRef(true)
  const reducedMotionRef = useRef(false)
  const controlsRef = useRef<{
    scheduleHold: () => void
    stopAll: () => void
  } | null>(null)

  const imageCount = HERO_BACKGROUND_IMAGES.length
  const nextIndex = (currentIndex + 1) % imageCount

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = media.matches
    const onChange = () => {
      reducedMotionRef.current = media.matches
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    let holdTimer: ReturnType<typeof setTimeout> | null = null
    let rafId = 0
    let wipeStartMs = 0
    let cancelled = false

    const clearHold = () => {
      if (holdTimer !== null) {
        clearTimeout(holdTimer)
        holdTimer = null
      }
    }

    const cancelWipeRaf = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    const setWipeClip = (leftPercent: number) => {
      const layer = wipeLayerRef.current
      if (layer) {
        layer.style.clipPath = `inset(0 0 0 ${leftPercent}%)`
      }
      const divider = dividerRef.current
      if (divider) {
        divider.style.left = `${leftPercent}%`
      }
    }

    const stopAll = () => {
      clearHold()
      cancelWipeRaf()
      setWipeClip(100)
      setWiping(false)
      if (wipeLayerRef.current) {
        wipeLayerRef.current.style.willChange = 'auto'
      }
    }

    const finishWipe = () => {
      cancelWipeRaf()
      const next = (currentIndexRef.current + 1) % imageCount
      currentIndexRef.current = next
      setCurrentIndex(next)
      setWipeClip(100)
      setWiping(false)
      if (wipeLayerRef.current) {
        wipeLayerRef.current.style.willChange = 'auto'
      }
      scheduleHold()
    }

    const wipeTick = (now: number) => {
      if (cancelled) return

      if (document.hidden || !inViewRef.current) {
        stopAll()
        return
      }

      const elapsed = now - wipeStartMs
      const progress = Math.min(elapsed / HERO_BACKGROUND_WIPE_DURATION_MS, 1)
      setWipeClip(100 - progress * 100)

      if (progress >= 1) {
        finishWipe()
        return
      }

      rafId = window.requestAnimationFrame(wipeTick)
    }

    const startWipe = () => {
      if (cancelled || reducedMotionRef.current) return
      if (document.hidden || !inViewRef.current) return

      setWiping(true)
      setWipeClip(100)
      if (wipeLayerRef.current) {
        wipeLayerRef.current.style.willChange = 'clip-path'
      }
      wipeStartMs = performance.now()
      rafId = window.requestAnimationFrame(wipeTick)
    }

    const scheduleHold = () => {
      clearHold()
      if (cancelled || reducedMotionRef.current) return
      if (document.hidden || !inViewRef.current) return

      holdTimer = setTimeout(() => {
        holdTimer = null
        if (cancelled) return
        if (document.hidden || !inViewRef.current || reducedMotionRef.current) {
          return
        }
        startWipe()
      }, HERO_BACKGROUND_HOLD_DURATION_MS)
    }

    controlsRef.current = { scheduleHold, stopAll }

    const onVisibility = () => {
      if (document.hidden) {
        stopAll()
      } else if (inViewRef.current && !reducedMotionRef.current) {
        scheduleHold()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    scheduleHold()

    return () => {
      cancelled = true
      controlsRef.current = null
      stopAll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [imageCount])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting)
        inViewRef.current = visible
        if (!visible) {
          controlsRef.current?.stopAll()
        } else if (!document.hidden && !reducedMotionRef.current) {
          controlsRef.current?.scheduleHold()
        }
      },
      { threshold: 0.05 },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={rootRef}
      className="absolute inset-x-0 top-0 z-0 h-screen overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          ...imageStyle,
          backgroundImage: `url('${HERO_BACKGROUND_IMAGES[currentIndex]}')`,
        }}
      />

      <div
        ref={wipeLayerRef}
        className="absolute inset-0"
        style={{
          ...imageStyle,
          backgroundImage: `url('${HERO_BACKGROUND_IMAGES[nextIndex]}')`,
          clipPath: 'inset(0 0 0 100%)',
        }}
      />

      <div
        ref={dividerRef}
        className="pointer-events-none absolute inset-y-0 z-[1] -translate-x-1/2"
        style={{
          left: '100%',
          opacity: wiping ? 1 : 0,
          visibility: wiping ? 'visible' : 'hidden',
        }}
      >
        <div className="relative h-full w-px bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.45)]">
          <div
            className="absolute top-1/2 left-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95 shadow-[0_0_10px_rgba(255,255,255,0.35)]"
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
