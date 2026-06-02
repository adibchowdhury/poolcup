'use client'

import { useClientNow } from '@/hooks/use-client-now'

/** World Cup 2026 opening kickoff (UTC). */
const WORLD_CUP_KICKOFF_MS = Date.parse('2026-06-11T00:00:00.000Z')

function formatDaysHoursRemaining(ms: number): string {
  if (ms <= 0) return '0 days 0 hours'

  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

  const dayLabel = days === 1 ? 'day' : 'days'
  const hourLabel = hours === 1 ? 'hour' : 'hours'

  return `${days} ${dayLabel} ${hours} ${hourLabel}`
}

export function WorldCupUrgencyBanner() {
  const { mounted, nowMs } = useClientNow(60_000)
  const hasStarted = mounted && nowMs >= WORLD_CUP_KICKOFF_MS
  const remainingMs = WORLD_CUP_KICKOFF_MS - nowMs

  return (
    <div
      className="rounded-lg border-l-4 px-4 py-3 text-sm leading-relaxed sm:px-5 sm:py-3.5 sm:text-base"
      style={{ backgroundColor: '#0d1f14', borderLeftColor: '#22c55e' }}
      role="status"
    >
      {!mounted ? (
        <p className="text-white">
          <span aria-hidden>⚽ </span>
          World Cup kicks off in{' '}
          <span className="font-bold text-[#22c55e]">—</span> — make your
          predictions before kickoff!
        </p>
      ) : hasStarted ? (
        <p className="text-white">
          <span aria-hidden>⚽ </span>
          The World Cup is LIVE — predictions lock before each match kickoff!
        </p>
      ) : (
        <p className="text-white">
          <span aria-hidden>⚽ </span>
          World Cup kicks off in{' '}
          <span className="font-bold text-[#22c55e]">
            {formatDaysHoursRemaining(remainingMs)}
          </span>{' '}
          — make your predictions before kickoff!
        </p>
      )}
    </div>
  )
}
