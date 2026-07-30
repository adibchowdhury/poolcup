'use client'

import { useEffect, useState } from 'react'

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

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[4.25rem] flex-col items-center rounded-2xl border border-white/10 bg-card/90 px-2.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.28),0_1px_0_rgba(255,255,255,0.05)_inset] sm:min-w-[5rem] sm:px-3 sm:py-4">
      <span className="font-display text-3xl leading-none tracking-wide tabular-nums text-foreground sm:text-4xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
    </div>
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

      {!ready ? (
        <div
          className="mt-4 grid grid-cols-4 gap-2 sm:gap-3"
          aria-hidden
        >
          {['Days', 'Hours', 'Mins', 'Secs'].map((label) => (
            <div
              key={label}
              className="flex min-w-[4.25rem] flex-col items-center rounded-2xl border border-white/10 bg-card/60 px-2.5 py-3 sm:min-w-[5rem] sm:px-3 sm:py-4"
            >
              <span className="font-display text-3xl leading-none tracking-wide text-muted-foreground/40 sm:text-4xl">
                --
              </span>
              <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
              </span>
            </div>
          ))}
        </div>
      ) : parts == null ? (
        <p className="mt-4 font-display text-3xl tracking-wide text-primary sm:text-4xl">
          Launching soon!
        </p>
      ) : (
        <div
          className="mt-4 grid grid-cols-4 justify-items-center gap-2 sm:gap-3"
          role="timer"
          aria-live="polite"
          aria-label={`Countdown to launch: ${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds`}
        >
          <CountdownUnit value={parts.days} label="Days" />
          <CountdownUnit value={parts.hours} label="Hours" />
          <CountdownUnit value={parts.minutes} label="Mins" />
          <CountdownUnit value={parts.seconds} label="Secs" />
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
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute left-1/4 top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-96 w-96 rounded-full bg-[#ffb300]/10 blur-3xl" />
      </div>

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
          We&apos;re back August 24
        </h1>

        <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
          Thank you for being part of PoolCup&apos;s first chapter. More than
          1,700 of you created pools, made predictions, and competed with friends
          during the World Cup — and this is just the beginning. PoolCup is being
          rebuilt into something bigger and better: more sports, more events, and
          new ways to compete all year long. We&apos;re back August 24. — Adib,
          Founder of PoolCup
        </p>

        <div className="mt-10 w-full max-w-md">
          <LaunchCountdown />
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
