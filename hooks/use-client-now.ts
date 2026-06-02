'use client'

import { useEffect, useState } from 'react'

/**
 * Returns a stable clock for SSR (mounted=false) and live time after hydration.
 * Avoids rendering Date.now()-dependent text on the server.
 */
export function useClientNow(intervalMs: number | null = 1000) {
  const [mounted, setMounted] = useState(false)
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    setMounted(true)
    setNowMs(Date.now())

    if (intervalMs == null || intervalMs <= 0) return

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, intervalMs)

    return () => window.clearInterval(interval)
  }, [intervalMs])

  return { mounted, nowMs }
}
