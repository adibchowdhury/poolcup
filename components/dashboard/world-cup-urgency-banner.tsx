'use client'

import { useEffect, useState } from 'react'
import { useClientNow } from '@/hooks/use-client-now'
import { supabase } from '@/src/lib/supabase'

/** Mexico vs South Africa — opening match (API-Football). */
const FALLBACK_OPENING_KICKOFF_MS = Date.parse('2026-06-11T19:00:00.000Z')

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
  const [openingKickoffMs, setOpeningKickoffMs] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadOpeningKickoff() {
      const { data, error } = await supabase
        .from('matches')
        .select('kickoff_at')
        .order('kickoff_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (!error && data?.kickoff_at) {
        setOpeningKickoffMs(new Date(data.kickoff_at).getTime())
      } else {
        if (error) {
          console.error('Failed to load opening match kickoff:', error.message)
        }
        setOpeningKickoffMs(FALLBACK_OPENING_KICKOFF_MS)
      }
    }

    void loadOpeningKickoff()

    return () => {
      cancelled = true
    }
  }, [])

  const kickoffReady = openingKickoffMs != null
  const hasStarted = mounted && kickoffReady && nowMs >= openingKickoffMs!
  const remainingMs = kickoffReady ? openingKickoffMs! - nowMs : 0

  return (
    <div
      className="rounded-lg border-l-4 px-4 py-3 text-sm leading-relaxed sm:px-5 sm:py-3.5 sm:text-base"
      style={{ backgroundColor: '#0d1f14', borderLeftColor: '#22c55e' }}
      role="status"
    >
      {!mounted || !kickoffReady ? (
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
