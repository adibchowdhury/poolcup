'use client'

import { useEffect, useState } from 'react'
import { useClientNow } from '@/hooks/use-client-now'
import { supabase } from '../lib/supabase-mobile'

const FALLBACK_OPENING_KICKOFF_MS = Date.parse('2026-06-11T19:00:00.000Z')

const NOTICE_CLASS =
  'rounded-lg border border-border/80 border-l-4 border-l-white/20 bg-card/80 px-4 py-3 text-sm leading-relaxed'

function formatDaysHoursRemaining(ms: number): string {
  if (ms <= 0) return '0 days 0 hours'

  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

  const dayLabel = days === 1 ? 'day' : 'days'
  const hourLabel = hours === 1 ? 'hour' : 'hours'

  return `${days} ${dayLabel} ${hours} ${hourLabel}`
}

export function MobileWorldCupBanner() {
  const { mounted, nowMs } = useClientNow(60_000)
  const [openingKickoffMs, setOpeningKickoffMs] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

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
    <div className={NOTICE_CLASS} role="status">
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
