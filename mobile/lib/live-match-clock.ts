'use client'

import { useEffect, useState } from 'react'

export const COUNTDOWN_TICK_MS = 1000

function padCountdownUnit(value: number): string {
  return value.toString().padStart(2, '0')
}

export function formatFeaturedMatchCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h ${padCountdownUnit(minutes)}m ${padCountdownUnit(seconds)}s`
  }

  return `${padCountdownUnit(hours)}:${padCountdownUnit(minutes)}:${padCountdownUnit(seconds)}`
}

function formatMatchClockSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${padCountdownUnit(minutes)}:${padCountdownUnit(seconds)}`
}

export function computeLiveMatchClockDisplay(
  kickoffAt: string,
  statusShort: string | null,
  nowMs: number,
): string | null {
  const status = (statusShort ?? '').trim().toUpperCase()
  if (!status) return null

  if (status === 'HT') return 'Halftime'
  if (status === 'P') return 'Penalties'

  const kickoffMs = new Date(kickoffAt).getTime()
  const elapsedSeconds = (nowMs - kickoffMs) / 1000

  if (status === '1H') {
    return formatMatchClockSeconds(elapsedSeconds)
  }

  if (status === '2H') {
    const secondHalfElapsedSeconds = elapsedSeconds - 60 * 60
    return formatMatchClockSeconds(45 * 60 + secondHalfElapsedSeconds)
  }

  if (status === 'ET') {
    const extraTimeElapsedSeconds = elapsedSeconds - 120 * 60
    return formatMatchClockSeconds(90 * 60 + extraTimeElapsedSeconds)
  }

  return null
}

export function useLiveMatchClock(match: {
  kickoff_at: string
  status_short: string | null
}): string | null {
  const [mounted, setMounted] = useState(false)
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    setMounted(true)
    setNowMs(Date.now())

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, COUNTDOWN_TICK_MS)

    return () => window.clearInterval(interval)
  }, [])

  if (!mounted) return null

  return computeLiveMatchClockDisplay(
    match.kickoff_at,
    match.status_short,
    nowMs,
  )
}

export function useKickoffCountdown(kickoffAt: string) {
  const [mounted, setMounted] = useState(false)
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    setMounted(true)
    setNowMs(Date.now())

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, COUNTDOWN_TICK_MS)

    return () => window.clearInterval(interval)
  }, [])

  const remainingMs = mounted
    ? new Date(kickoffAt).getTime() - nowMs
    : null

  return {
    mounted,
    isKickingOff: remainingMs != null && remainingMs <= 0,
    label:
      remainingMs != null && remainingMs > 0
        ? formatFeaturedMatchCountdown(remainingMs)
        : null,
  }
}
