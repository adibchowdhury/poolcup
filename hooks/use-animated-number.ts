'use client'

import { useEffect, useRef, useState } from 'react'

const DEFAULT_DURATION_MS = 1000

/** Ease-out cubic: fast start, slow finish. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Animates a number toward `target` over ~1s. On first run, starts from 0.
 * When `target` changes later, animates from the last displayed value.
 */
export function useAnimatedNumber(
  target: number,
  durationMs = DEFAULT_DURATION_MS,
): number {
  const [displayed, setDisplayed] = useState(0)
  const displayedRef = useRef(0)
  const hasAnimatedRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = hasAnimatedRef.current ? displayedRef.current : 0
    hasAnimatedRef.current = true

    if (from === target) {
      setDisplayed(target)
      displayedRef.current = target
      return
    }

    const startTime = performance.now()
    const delta = target - from

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const eased = easeOutCubic(progress)
      const value = Math.round(from + delta * eased)
      setDisplayed(value)
      displayedRef.current = value

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplayed(target)
        displayedRef.current = target
        rafRef.current = null
      }
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [target, durationMs])

  return displayed
}
