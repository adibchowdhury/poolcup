'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'

type SportId = 'soccer' | 'basketball' | 'baseball' | 'football' | 'hockey'

type SportFilter = 'all' | SportId

type SportMeta = {
  id: SportId
  label: string
  imageSrc: string
}

type SportEvent = {
  id: string
  sportId: SportId
  name: string
  dateRangeLabel: string
  startMs: number
  endMs: number
  monthYearLabel: string
}

const SPORTS: SportMeta[] = [
  { id: 'soccer', label: 'Soccer', imageSrc: '/sports/soccer.png' },
  { id: 'basketball', label: 'Basketball', imageSrc: '/sports/basketball.png' },
  { id: 'baseball', label: 'Baseball', imageSrc: '/sports/baseball.png' },
  { id: 'football', label: 'Football', imageSrc: '/sports/football.png' },
  { id: 'hockey', label: 'Hockey', imageSrc: '/sports/hockey.png' },
]

const COMING_SOON_WINDOW_MS = 90 * 24 * 60 * 60 * 1000

function startOfUtcDay(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function endOfUtcDay(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999,
  )
}

function monthRange(year: number, month: number) {
  const startMs = Date.UTC(year, month - 1, 1)
  const endMs = Date.UTC(year, month, 0, 23, 59, 59, 999)
  const label = new Date(startMs).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return { startMs, endMs, label }
}

const EVENTS: SportEvent[] = [
  {
    id: 'fifa-wc-2026',
    sportId: 'soccer',
    name: 'FIFA World Cup 2026',
    dateRangeLabel: 'Jun 11 – Jul 19, 2026',
    startMs: Date.parse('2026-06-11T00:00:00.000Z'),
    endMs: Date.parse('2026-07-19T23:59:59.999Z'),
    monthYearLabel: 'Jun 2026',
  },
  {
    id: 'premier-league-2026-27',
    sportId: 'soccer',
    name: 'Premier League 2026/27',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2026, 8)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'ucl-2026-27',
    sportId: 'soccer',
    name: 'UEFA Champions League 2026/27',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2026, 9)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'nfl-regular-2026',
    sportId: 'football',
    name: 'NFL Regular Season 2026',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2026, 9)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'nfl-playoffs-2027',
    sportId: 'football',
    name: 'NFL Playoffs 2027',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2027, 1)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'super-bowl-lxi',
    sportId: 'football',
    name: 'Super Bowl LXI',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2027, 2)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'ncaa-march-madness-2027',
    sportId: 'basketball',
    name: 'NCAA March Madness 2027',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2027, 3)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'nba-playoffs-2027',
    sportId: 'basketball',
    name: 'NBA Playoffs 2027',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2027, 4)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'nba-finals-2027',
    sportId: 'basketball',
    name: 'NBA Finals 2027',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2027, 6)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'mlb-playoffs-2026',
    sportId: 'baseball',
    name: 'MLB Playoffs 2026',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2026, 10)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'world-series-2026',
    sportId: 'baseball',
    name: 'World Series 2026',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2026, 10)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'nhl-playoffs-2027',
    sportId: 'hockey',
    name: 'NHL Playoffs 2027',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2027, 4)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
  {
    id: 'stanley-cup-finals-2027',
    sportId: 'hockey',
    name: 'Stanley Cup Finals 2027',
    ...(() => {
      const { startMs, endMs, label } = monthRange(2027, 6)
      return {
        dateRangeLabel: label,
        startMs,
        endMs,
        monthYearLabel: label,
      }
    })(),
  },
]

type EventBadge = {
  kind: 'live' | 'coming-soon' | 'month-year' | null
  label: string
}

function getEventBadge(event: SportEvent, nowMs: number, mounted: boolean): EventBadge {
  if (!mounted || nowMs <= 0) {
    return { kind: null, label: '' }
  }

  const rangeStart = startOfUtcDay(event.startMs)
  const rangeEnd = endOfUtcDay(event.endMs)

  if (nowMs >= rangeStart && nowMs <= rangeEnd) {
    return { kind: 'live', label: 'LIVE' }
  }

  if (nowMs < rangeStart) {
    const untilStart = rangeStart - nowMs
    if (untilStart <= COMING_SOON_WINDOW_MS) {
      return { kind: 'coming-soon', label: 'Coming Soon' }
    }
    return { kind: 'month-year', label: event.monthYearLabel }
  }

  return { kind: null, label: '' }
}

function EventCard({
  event,
  nowMs,
  mounted,
}: {
  event: SportEvent
  nowMs: number
  mounted: boolean
}) {
  const badge = getEventBadge(event, nowMs, mounted)

  return (
    <article className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111a27] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-[#f0f4f8]">{event.name}</h3>
          <p className="mt-1 text-sm text-[#5a7080]">{event.dateRangeLabel}</p>
        </div>
        {badge.kind ? (
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
              badge.kind === 'live' &&
                'border border-[#00e676]/30 bg-[#00e676]/15 text-[#00e676]',
              badge.kind === 'coming-soon' &&
                'border border-[#ffb300]/30 bg-[#ffb300]/15 text-[#ffb300]',
              badge.kind === 'month-year' &&
                'border border-[rgba(255,255,255,0.08)] bg-[#1a2535] text-[#5a7080]',
            )}
          >
            {badge.label}
          </span>
        ) : null}
      </div>
    </article>
  )
}

export function SportsSection() {
  const [activeFilter, setActiveFilter] = useState<SportFilter>('soccer')
  const { mounted, nowMs } = useClientNow(60_000)

  const filteredEvents = useMemo(() => {
    const sorted = [...EVENTS].sort((a, b) => a.startMs - b.startMs)
    if (activeFilter === 'all') return sorted
    return sorted.filter((event) => event.sportId === activeFilter)
  }, [activeFilter])

  return (
    <section className="bg-[#0d1520] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#5a7080]">
            Multi-sport pools
          </p>
          <h2 className="mb-4 font-display text-4xl text-[#f0f4f8] md:text-5xl">
            PICK YOUR SPORT
          </h2>
          <p className="text-lg leading-relaxed text-[#5a7080]">
            When you create a pool, choose the sport your squad wants to follow.
            Soccer is live for World Cup 2026 — more sports are on the way.
          </p>
        </div>

        <div className="mx-auto mt-12 flex max-w-5xl flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={cn(
              'rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
              activeFilter === 'all'
                ? 'border-[#00e676]/30 bg-[#00e676]/5 text-[#00e676]'
                : 'border-[rgba(255,255,255,0.08)] bg-[#111a27] text-[#f0f4f8] hover:border-[#00e676]/30',
            )}
          >
            All
          </button>
          {SPORTS.map((sport) => (
            <button
              key={sport.id}
              type="button"
              onClick={() => setActiveFilter(sport.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                activeFilter === sport.id
                  ? 'border-[#00e676]/30 bg-[#00e676]/5 text-[#00e676]'
                  : 'border-[rgba(255,255,255,0.08)] bg-[#111a27] text-[#f0f4f8] hover:border-[#00e676]/30',
              )}
            >
              <Image
                src={sport.imageSrc}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                aria-hidden
              />
              {sport.label}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              nowMs={nowMs}
              mounted={mounted}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
