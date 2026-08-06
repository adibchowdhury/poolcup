'use client'

import '@fontsource/vt323/400.css'
import { useEffect, useState } from 'react'
import { WaitlistForm } from '@/components/landing/waitlist-form'

/** Official launch target: August 24, 2026 (00:00 UTC). */
const LAUNCH_AT_MS = Date.UTC(2026, 7, 24, 0, 0, 0)

type CountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getCountdownParts(nowMs: number): CountdownParts | null {
  const remaining = LAUNCH_AT_MS - nowMs
  if (remaining <= 0) return null

  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds }
}

function ScoreboardUnit({
  value,
  label,
}: {
  value: number | null
  label: string
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <span
        className="text-[clamp(2.2rem,10vw,4.5rem)] leading-[0.78] tracking-[0.04em] tabular-nums text-primary [text-shadow:0_0_8px_rgba(0,230,118,0.85),0_0_22px_rgba(0,230,118,0.35)]"
        style={{
          fontFamily: '"VT323", "Space Mono", monospace',
        }}
      >
        {value == null ? '--' : String(value).padStart(2, '0')}
      </span>
      <span className="mt-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-white/40 sm:text-[10px]">
        {label}
      </span>
    </div>
  )
}

function ScoreboardColon() {
  return (
    <span
      className="mb-4 shrink-0 text-[clamp(1.9rem,7vw,3.75rem)] leading-none text-primary [text-shadow:0_0_8px_rgba(0,230,118,0.8)]"
      style={{
        fontFamily: '"VT323", "Space Mono", monospace',
      }}
      aria-hidden
    >
      :
    </span>
  )
}

function LaunchCountdown() {
  const [parts, setParts] = useState<CountdownParts | null>(() =>
    getCountdownParts(Date.now()),
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setParts(getCountdownParts(Date.now()))
    setReady(true)

    const id = window.setInterval(() => {
      setParts(getCountdownParts(Date.now()))
    }, 1000)

    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="w-full">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        Launching August 24
      </p>

      {ready && parts == null ? (
        <div className="relative mt-4 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#030705] px-5 py-8 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_2px_0_rgba(255,255,255,0.05)_inset,0_-2px_0_rgba(0,0,0,0.8)_inset]">
          <p
            className="text-4xl tracking-wider text-primary [text-shadow:0_0_10px_rgba(0,230,118,0.8)] sm:text-5xl"
            style={{ fontFamily: '"VT323", "Space Mono", monospace' }}
          >
            Launching soon!
          </p>
        </div>
      ) : (
        <div
          className="relative mt-4 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#030705] px-3 py-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_2px_0_rgba(255,255,255,0.05)_inset,0_-2px_0_rgba(0,0,0,0.8)_inset] sm:px-6 sm:py-8"
          role={ready ? 'timer' : undefined}
          aria-label={
            ready && parts
              ? `Countdown to launch: ${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds`
              : 'Loading launch countdown'
          }
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:radial-gradient(circle,rgba(0,230,118,0.45)_0.7px,transparent_0.8px)] [background-size:4px_4px]"
            aria-hidden
          />
          <div className="relative flex items-end justify-center gap-1 sm:gap-2">
            <ScoreboardUnit value={parts?.days ?? null} label="Days" />
            <ScoreboardColon />
            <ScoreboardUnit value={parts?.hours ?? null} label="Hrs" />
            <ScoreboardColon />
            <ScoreboardUnit value={parts?.minutes ?? null} label="Min" />
            <ScoreboardColon />
            <ScoreboardUnit value={parts?.seconds ?? null} label="Sec" />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Self-contained coming-soon content — no auth or shared chrome deps.
 */
export function ComingSoonContent() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16">
      <main className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/poolcup-logo.png"
          alt="PoolCup"
          className="h-14 w-auto object-contain sm:h-16"
        />

        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          Coming soon
        </p>

        <h1 className="mt-4 font-display text-4xl tracking-wide text-foreground sm:text-5xl">
          Something big is coming
        </h1>

        <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
          PoolCup is being rebuilt into something bigger and better: more sports,
          more events, and new ways to compete all year long. — The PoolCup Team
        </p>

        <div className="mt-10 w-full max-w-md">
          <LaunchCountdown />
        </div>

        <div className="mt-10 w-full max-w-md">
          <WaitlistForm variant="coming-soon" />
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Questions? Reach us at{' '}
          <a
            href="mailto:support@getpoolcup.com"
            className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/90 hover:underline"
          >
            support@getpoolcup.com
          </a>
        </p>
      </main>
    </div>
  )
}
