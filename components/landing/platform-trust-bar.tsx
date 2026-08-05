'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  fetchPlatformStats,
  formatTrustBarStats,
  type TrustBarStat,
} from '@/src/lib/platform-stats'
import { supabase } from '@/src/lib/supabase'
import {
  RevealItem,
  ScrollRevealGroup,
} from '@/components/landing/scroll-reveal'

function isLeaguesStat(id: string): boolean {
  return id === 'competitions' || id === 'leagues'
}

/** Shared floating-bridge placement: no band, straddles hero / next section. */
const BRIDGE_WRAPPER_CLASS =
  'relative z-30 -mt-12 -mb-12 px-3 sm:-mt-14 sm:-mb-14 sm:px-6 md:-mt-16 md:-mb-16'

const CARD_CLASS = cn(
  'mx-auto max-w-5xl rounded-3xl border border-[rgba(255,255,255,0.12)]',
  'bg-[#131313] px-3 py-4 sm:px-6 sm:py-7 md:px-4',
  'shadow-[0_24px_60px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)]',
)

function TrustBarSkeleton() {
  return (
    <div
      className={BRIDGE_WRAPPER_CLASS}
      aria-busy="true"
      aria-label="Loading platform stats"
    >
      <div className={CARD_CLASS}>
        <div className="flex flex-row items-start justify-between gap-2 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-0">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={cn(
                'min-w-0 flex-1 text-center sm:px-4 lg:px-5',
                index > 0 &&
                  'border-l border-[rgba(255,255,255,0.08)] pl-2 sm:border-0 sm:pl-0 lg:border-l lg:pl-5',
                index === 3 && 'hidden sm:block',
              )}
            >
              <div
                className="mx-auto h-6 w-16 animate-pulse rounded-md bg-[rgba(255,255,255,0.1)] sm:h-7 sm:w-24"
                aria-hidden
              />
              <div
                className="mx-auto mt-2 h-3 w-20 animate-pulse rounded-md bg-[rgba(255,255,255,0.06)] sm:h-3.5 sm:w-28"
                aria-hidden
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TrustBarStatItem({
  stat,
  showDivider,
}: {
  stat: TrustBarStat
  showDivider: boolean
}) {
  const hideOnMobile = isLeaguesStat(stat.id)

  return (
    <div
      className={cn(
        'min-w-0 flex-1 text-center sm:px-4 lg:px-5',
        hideOnMobile && 'hidden sm:block',
        showDivider &&
          'border-l border-[rgba(255,255,255,0.08)] pl-2 sm:border-0 sm:pl-0 lg:border-l lg:pl-5',
      )}
    >
      <div
        className={cn(
          'font-display tracking-wide leading-none',
          stat.prominent
            ? 'text-lg text-[#00e676] sm:text-[1.65rem] md:text-3xl'
            : 'text-base text-[#f0f4f8] sm:text-2xl md:text-[1.65rem]',
        )}
      >
        {stat.value}
      </div>
      <div className="mt-1.5 text-[11px] capitalize leading-snug text-[#728d9c] sm:mt-2 sm:text-[13px]">
        {stat.label}
      </div>
    </div>
  )
}

export function PlatformTrustBar() {
  const [stats, setStats] = useState<TrustBarStat[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'hidden'>('loading')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const raw = await fetchPlatformStats(supabase)
      if (cancelled) return

      if (!raw) {
        setStatus('hidden')
        return
      }

      const formatted = formatTrustBarStats(raw)
      if (!formatted) {
        setStatus('hidden')
        return
      }

      setStats(formatted)
      setStatus('ready')
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'hidden') return null
  if (status === 'loading' || !stats) return <TrustBarSkeleton />

  return (
    <ScrollRevealGroup
      className={BRIDGE_WRAPPER_CLASS}
      threshold={0.2}
      as="div"
    >
      <RevealItem
        index={0}
        className={CARD_CLASS}
        as="div"
      >
        <div
          className="flex flex-row items-start justify-between gap-2 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-0"
          aria-label="Platform stats"
          role="region"
        >
          {stats.map((stat, index) => (
            <TrustBarStatItem
              key={stat.id}
              stat={stat}
              showDivider={index > 0}
            />
          ))}
        </div>
      </RevealItem>
    </ScrollRevealGroup>
  )
}
