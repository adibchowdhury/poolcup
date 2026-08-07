'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FeaturedMatchMode } from '@/src/lib/featured-match'
import { isTeamLogoUrl } from '@/src/lib/team-logos'

export type PremiumMatchCardMatch = {
  id: string
  team1_name: string
  team2_name: string
  team1_logo?: string | null
  team2_logo?: string | null
  result_team1: number | null
  result_team2: number | null
  status_short: string | null
  elapsed_minute: number | null
  kickoff_at: string
  is_final: boolean
}

const INITIALS_STOP_WORDS = new Set([
  'afc',
  'cf',
  'club',
  'de',
  'fc',
  'sc',
  'the',
])

/**
 * Responsive sculpted card silhouette:
 * - continuous rounded top edge sits behind the overlapping status tab
 * - bottom-center point creates the reference's downward notch
 * - quadratic/cubic curves preserve rounded outer corners
 */
const SCULPTED_CARD_PATH =
  'M20 1 H340 Q359 1 359 20 V185 Q359 198 346 198 H202 L180 208 L158 198 H14 Q1 198 1 185 V20 Q1 1 20 1 Z'
const SCULPTED_BOTTOM_EDGE_PATH = 'M14 198 H158 L180 208 L202 198 H346'

/** Monogram fallback when a club crest URL is missing or fails to load. */
export function getTeamInitials(teamName: string): string {
  const normalized = teamName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()

  const words = normalized
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((word) => !INITIALS_STOP_WORDS.has(word.toLowerCase()))

  if (words.length === 0) return '—'

  // Familiar football shorthand; e.g. Atlético Madrid → ATL.
  if (/^atletico\b/i.test(normalized)) return 'ATL'

  if (words.length === 1) {
    return words[0]!.slice(0, 3).toUpperCase()
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function formatStatusDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusNotch({
  mode,
  elapsedMinute,
  kickoffAt,
}: {
  mode: FeaturedMatchMode
  elapsedMinute: number | null
  kickoffAt: string
}) {
  const isLive = mode === 'live'
  const isFinal = mode === 'final'
  const label = isLive
    ? `Live${elapsedMinute != null ? ` · ${elapsedMinute}'` : ''}`
    : isFinal
      ? 'FT'
      : formatStatusDate(kickoffAt)

  return (
    <div
      className={cn(
        'absolute left-1/2 top-0 z-20 flex h-6 min-w-20 -translate-x-1/2 items-center justify-center px-3.5',
        'text-[9px] font-bold uppercase tracking-[0.13em]',
        'bg-[linear-gradient(180deg,#e84b55,#ba2532)] text-white shadow-[0_4px_12px_rgba(220,38,52,0.28)]',
      )}
      style={{
        clipPath:
          'polygon(0 0, 100% 0, 100% 58%, 88% 100%, 12% 100%, 0 58%)',
      }}
    >
      {isLive ? (
        <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
      ) : null}
      {label}
    </div>
  )
}

function TeamMark({
  name,
  logoUrl = null,
}: {
  name: string
  logoUrl?: string | null
}) {
  const crestSrc = isTeamLogoUrl(logoUrl) ? logoUrl!.trim() : null
  const [crestFailed, setCrestFailed] = useState(false)

  useEffect(() => {
    setCrestFailed(false)
  }, [crestSrc])

  const showCrest = crestSrc != null && !crestFailed

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      {showCrest ? (
        <div className="flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={crestSrc}
            alt=""
            className="h-12 w-12 object-contain sm:h-14 sm:w-14"
            onError={() => setCrestFailed(true)}
          />
        </div>
      ) : (
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-full border p-1 shadow-[0_9px_18px_rgba(0,0,0,0.12)] sm:h-16 sm:w-16"
          style={{
            borderColor: 'var(--match-card-mark-border)',
            background: 'var(--match-card-mark-bg)',
          }}
        >
          <div
            className="absolute inset-1 rounded-full border"
            style={{
              borderColor: 'var(--match-card-mark-ring)',
              background: 'var(--match-card-mark-inner)',
            }}
            aria-hidden
          />
          <span
            className="relative font-display text-xl tracking-[0.09em] sm:text-2xl"
            style={{ color: 'var(--match-card-mark-text)' }}
          >
            {getTeamInitials(name)}
          </span>
        </div>
      )}
      <p className="mt-1.5 line-clamp-2 min-h-8 w-full text-center text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
        {name}
      </p>
    </div>
  )
}

export function PremiumMatchCard({
  match,
  mode,
  competitionName,
  href,
  className,
}: {
  match: PremiumMatchCardMatch
  mode: FeaturedMatchMode
  competitionName?: string | null
  href?: string | null
  className?: string
}) {
  const showScore = mode === 'live' || mode === 'final'
  const score1 = match.result_team1 ?? 0
  const score2 = match.result_team2 ?? 0
  const id = useId().replace(/:/g, '')
  const surfaceGradientId = `match-surface-${id}`
  const surfaceGlowId = `match-glow-${id}`

  const body = (
    <article
      className={cn(
        'premium-match-card group relative isolate flex h-full min-h-[12.25rem] flex-col overflow-visible',
        'px-3.5 pb-3 pt-8',
        'transition-[transform,filter] hover:-translate-y-0.5',
        className,
      )}
      aria-label={`${match.team1_name} vs ${match.team2_name}`}
    >
      <svg
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible"
        viewBox="0 0 360 208"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient
            id={surfaceGradientId}
            x1="36"
            y1="0"
            x2="316"
            y2="208"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="var(--match-card-fill-0)" />
            <stop offset="0.5" stopColor="var(--match-card-fill-1)" />
            <stop offset="1" stopColor="var(--match-card-fill-2)" />
          </linearGradient>
          <radialGradient
            id={surfaceGlowId}
            cx="0"
            cy="0"
            r="1"
            gradientTransform="translate(180 12) rotate(90) scale(105 188)"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              stopColor="var(--match-card-glow)"
              stopOpacity="var(--match-card-glow-opacity)"
            />
            <stop offset="0.72" stopColor="#111111" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={SCULPTED_CARD_PATH} fill={`url(#${surfaceGradientId})`} />
        <path d={SCULPTED_CARD_PATH} fill={`url(#${surfaceGlowId})`} />
        <path
          d={SCULPTED_CARD_PATH}
          fill="none"
          stroke="var(--match-card-stroke)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={SCULPTED_BOTTOM_EDGE_PATH}
          fill="none"
          stroke="#00e676"
          strokeOpacity="0.12"
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
          className="blur-[2px]"
        />
        <path
          d={SCULPTED_BOTTOM_EDGE_PATH}
          fill="none"
          stroke="#00e676"
          strokeOpacity="0.48"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <StatusNotch
        mode={mode}
        elapsedMinute={match.elapsed_minute}
        kickoffAt={match.kickoff_at}
      />

      <p className="relative truncate text-center text-[10px] font-medium uppercase tracking-[0.11em] text-muted-foreground">
        {competitionName || 'PoolCup'}
      </p>

      <div className="relative mt-2.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5">
        <TeamMark name={match.team1_name} logoUrl={match.team1_logo} />

        <div className="flex min-h-16 min-w-[5rem] items-center justify-center self-start sm:min-w-[6rem]">
          {showScore ? (
            <p
              className="font-display text-4xl leading-none tracking-[0.02em] tabular-nums sm:text-5xl"
              style={{
                color: 'var(--match-card-score)',
                textShadow: 'var(--match-card-score-shadow)',
              }}
            >
              <span>{score1}</span>
              <span
                className="mx-0.5"
                style={{ color: 'var(--match-card-score-sep)' }}
              >
                :
              </span>
              <span>{score2}</span>
            </p>
          ) : (
            <span
              className="font-display text-3xl tracking-[0.14em] sm:text-4xl"
              style={{
                color: 'var(--match-card-vs)',
                textShadow: 'var(--match-card-score-shadow)',
              }}
            >
              VS
            </span>
          )}
        </div>

        <TeamMark name={match.team2_name} logoUrl={match.team2_logo} />
      </div>

      <div
        className="relative mt-auto flex items-center justify-center gap-1.5 border-t pt-2 text-[10px] font-medium text-muted-foreground"
        style={{ borderColor: 'var(--match-card-footer-border)' }}
      >
        <Clock3
          className="h-3 w-3"
          style={{ color: 'var(--match-card-clock)' }}
          aria-hidden
        />
        <time dateTime={match.kickoff_at} suppressHydrationWarning>
          {formatKickoff(match.kickoff_at)}
        </time>
      </div>
    </article>
  )

  if (!href) return body

  return (
    <Link
      href={href}
      className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      aria-label={`${match.team1_name} vs ${match.team2_name}. View match details`}
    >
      {body}
    </Link>
  )
}
