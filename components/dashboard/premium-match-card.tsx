'use client'

import { useEffect, useId, useState, type MouseEvent, type PointerEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Clock3, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import type { MatchesTabPredictionSummary } from '@/src/lib/fetch-matches-tab-predictions'
import {
  FeaturedMatchCountdownDisplay,
  useKickoffCountdown,
  useLiveMatchClock,
} from '@/components/dashboard/live-scoreboard'
import type { FeaturedMatchMode } from '@/src/lib/featured-match'
import { formatFeaturedMatchStatusLabel } from '@/src/lib/featured-match'
import { isTeamLogoUrl } from '@/src/lib/team-logos'
import {
  getVoidMatchStatusLabel,
  isVoidMatchStatus,
} from '@/src/lib/match-void-status'

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

function QueueStatusNotch({ kickoffAt }: { kickoffAt: string }) {
  const countdown = useKickoffCountdown(kickoffAt)

  return (
    <div
      className={cn(
        'absolute left-1/2 top-0 z-20 flex h-6 min-w-20 max-w-[90%] -translate-x-1/2 items-center justify-center px-3.5',
        'bg-[linear-gradient(180deg,#e84b55,#ba2532)] text-white shadow-[0_4px_12px_rgba(220,38,52,0.28)]',
        'text-[9px] font-bold uppercase tracking-[0.13em]',
      )}
      style={{
        clipPath:
          'polygon(0 0, 100% 0, 100% 58%, 88% 100%, 12% 100%, 0 58%)',
      }}
    >
      {countdown.isKickingOff ? (
        <span className="truncate" suppressHydrationWarning>
          Kicking off
        </span>
      ) : (
        <FeaturedMatchCountdownDisplay compact {...countdown} />
      )}
    </div>
  )
}

function LiveWatchNotch() {
  return (
    <div
      className={cn(
        'absolute left-1/2 top-0 z-20 flex h-6 min-w-20 max-w-[92%] -translate-x-1/2 items-center justify-center gap-1.5 px-3',
        'bg-[linear-gradient(180deg,#e84b55,#ba2532)] text-white shadow-[0_4px_12px_rgba(220,38,52,0.28)]',
        'text-[9px] font-bold uppercase tracking-[0.13em]',
      )}
      style={{
        clipPath:
          'polygon(0 0, 100% 0, 100% 58%, 88% 100%, 12% 100%, 0 58%)',
      }}
    >
      <span
        className="stage-live-dot h-1.5 w-1.5 shrink-0 rounded-full"
        aria-hidden
      />
      <span>Live</span>
    </div>
  )
}

function StatusNotch({
  mode,
  elapsedMinute,
  kickoffAt,
  voidLabel,
}: {
  mode: FeaturedMatchMode
  elapsedMinute: number | null
  kickoffAt: string
  voidLabel: string | null
}) {
  const isLive = mode === 'live'
  const isFinal = mode === 'final'
  const isVoid = Boolean(voidLabel)
  const label = isVoid
    ? voidLabel!
    : isLive
      ? `Live${elapsedMinute != null ? ` · ${elapsedMinute}'` : ''}`
      : isFinal
        ? 'FT'
        : formatStatusDate(kickoffAt)

  return (
    <div
      className={cn(
        'absolute left-1/2 top-0 z-20 flex h-6 min-w-20 max-w-[90%] -translate-x-1/2 items-center justify-center px-3.5',
        'text-[9px] font-bold uppercase tracking-[0.13em]',
        isVoid
          ? 'bg-[linear-gradient(180deg,#64748b,#475569)] text-white shadow-[0_4px_12px_rgba(71,85,105,0.28)]'
          : 'bg-[linear-gradient(180deg,#e84b55,#ba2532)] text-white shadow-[0_4px_12px_rgba(220,38,52,0.28)]',
      )}
      style={{
        clipPath:
          'polygon(0 0, 100% 0, 100% 58%, 88% 100%, 12% 100%, 0 58%)',
      }}
    >
      {isLive && !isVoid ? (
        <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
      ) : null}
      <span className="truncate">{label}</span>
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

function QueuePoolContextLine({ poolNames }: { poolNames: string[] }) {
  if (poolNames.length === 0) return null

  if (poolNames.length === 1) {
    return (
      <p className="min-w-0 truncate text-center text-[10px] font-medium text-muted-foreground">
        {poolNames[0]}
      </p>
    )
  }

  const label = `${poolNames[0]} +${poolNames.length - 1}`
  return (
    <p
      className="min-w-0 truncate text-center text-[10px] font-medium text-muted-foreground"
      title={poolNames.join(', ')}
    >
      {label}
    </p>
  )
}

export type PremiumMatchCardAccentVariant = 'bottom' | 'full'

function stopCardNavigation(event: MouseEvent | PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function MatchesTabPredictionFooter({
  prediction,
  actionHref,
}: {
  prediction: MatchesTabPredictionSummary
  actionHref: string
}) {
  const { status, pickLabel } = prediction

  return (
    <div className="hidden min-w-0 shrink-0 items-center gap-1.5 lg:flex">
      {status === 'not_picked' ? (
        <span className="truncate text-[10px] font-medium text-muted-foreground/75">
          Not picked
        </span>
      ) : null}
      {status === 'picked' || status === 'locked_picked' ? (
        <span className="inline-flex min-w-0 items-center gap-0.5 truncate text-[10px] font-semibold text-primary">
          <Check className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">
            Picked{pickLabel ? ` ${pickLabel}` : ''}
          </span>
        </span>
      ) : null}
      {status === 'locked_unpicked' ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          Locked
        </span>
      ) : null}
      {status === 'not_picked' ? (
        <Button
          asChild
          size="sm"
          className={cn(
            'pointer-events-auto relative z-[2] h-7 shrink-0 px-2.5 text-xs',
            FOCUS_VISIBLE_RING,
          )}
        >
          <Link
            href={actionHref}
            onClick={stopCardNavigation}
            onPointerDown={stopCardNavigation}
          >
            Predict
          </Link>
        </Button>
      ) : null}
      {status === 'picked' ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            'pointer-events-auto relative z-[2] h-7 shrink-0 px-2 text-xs font-semibold text-primary',
            FOCUS_VISIBLE_RING,
          )}
        >
          <Link
            href={actionHref}
            onClick={stopCardNavigation}
            onPointerDown={stopCardNavigation}
          >
            Edit
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

export function PremiumMatchCard({
  match,
  mode,
  competitionName,
  href,
  className,
  showQueueCountdown = false,
  queuePoolNames,
  queuePicked = false,
  predictCtaLabel,
  queueMode = false,
  accentVariant = 'bottom',
  liveWatchMode = false,
  footerBottomInset = false,
  matchesTabPrediction,
}: {
  match: PremiumMatchCardMatch
  mode: FeaturedMatchMode
  competitionName?: string | null
  href?: string | null
  className?: string
  /** Queue: countdown in status notch (upcoming only). */
  showQueueCountdown?: boolean
  /** Queue: pool names still needing this pick. */
  queuePoolNames?: string[]
  /** Queue: user picked this match in the current session. */
  queuePicked?: boolean
  /** Queue: footer CTA copy; card href still navigates to predict flow. */
  predictCtaLabel?: string
  /** Queue: omit generic competition fallback. */
  queueMode?: boolean
  /** bottom = upcoming default notch; full = live ring around entire card. */
  accentVariant?: PremiumMatchCardAccentVariant
  /** Matches tab live strip: mono score, LIVE notch, clock footer, no predict CTA. */
  liveWatchMode?: boolean
  /** Matches tab desktop: breathing room below kickoff / live clock row. */
  footerBottomInset?: boolean
  /** Matches tab desktop: prediction state + Predict/Edit in footer. */
  matchesTabPrediction?: MatchesTabPredictionSummary | null
}) {
  const voidLabel = getVoidMatchStatusLabel(match.status_short)
  const isVoid = isVoidMatchStatus(match.status_short)
  const showScore = !isVoid && (mode === 'live' || mode === 'final')
  const score1 = match.result_team1 ?? 0
  const score2 = match.result_team2 ?? 0
  const id = useId().replace(/:/g, '')
  const surfaceGradientId = `match-surface-${id}`
  const surfaceGlowId = `match-glow-${id}`

  const resolvedCtaLabel =
    liveWatchMode && mode === 'live' ? undefined : queuePicked ? 'Edit' : predictCtaLabel
  const useFullAccent = accentVariant === 'full'
  const isLiveStripLayout = Boolean(liveWatchMode)
  const liveClock = useLiveMatchClock(match)
  const liveClockFallback =
    liveWatchMode && mode === 'live'
      ? formatFeaturedMatchStatusLabel(
          match.status_short,
          match.elapsed_minute,
          match.is_final,
        )
      : null
  const eventLabel =
    queueMode && competitionName?.trim()
      ? competitionName.trim()
      : queueMode
        ? null
        : competitionName || 'PoolCup'

  const showMatchesTabPrediction =
    Boolean(matchesTabPrediction) && mode === 'upcoming' && !liveWatchMode
  const cardNavigateHref = href ?? null
  const matchesTabActionHref = cardNavigateHref

  const body = (
    <article
      className={cn(
        'premium-match-card group relative isolate flex h-full min-h-[220px] flex-col overflow-hidden',
        'px-3.5 pb-3 pt-8',
        'transition-[transform,box-shadow] hover:-translate-y-0.5',
        queuePicked && 'ring-1 ring-primary/35',
        className,
      )}
      aria-label={`${match.team1_name} vs ${match.team2_name}`}
    >
      <svg
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
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
        {useFullAccent ? (
          <>
            <path
              d={SCULPTED_CARD_PATH}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity="0.28"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
              className="blur-[1.5px]"
            />
            <path
              d={SCULPTED_CARD_PATH}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity="0.78"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          <>
            <path
              d={SCULPTED_BOTTOM_EDGE_PATH}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity="0.12"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
              className="blur-[2px]"
            />
            <path
              d={SCULPTED_BOTTOM_EDGE_PATH}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity="0.48"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {liveWatchMode && mode === 'live' ? (
        <LiveWatchNotch />
      ) : showQueueCountdown && mode === 'upcoming' ? (
        <QueueStatusNotch kickoffAt={match.kickoff_at} />
      ) : (
        <StatusNotch
          mode={mode}
          elapsedMinute={match.elapsed_minute}
          kickoffAt={match.kickoff_at}
          voidLabel={voidLabel}
        />
      )}

      <div className="relative flex min-h-[2rem] flex-col items-center justify-center gap-0.5">
        {eventLabel ? (
          <p className="min-w-0 truncate text-center text-[10px] font-medium uppercase tracking-[0.11em] text-muted-foreground">
            {eventLabel}
          </p>
        ) : null}
        {queueMode ? (
          <QueuePoolContextLine poolNames={queuePoolNames ?? []} />
        ) : null}
      </div>

      <div className="relative mt-2.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5">
        <TeamMark name={match.team1_name} logoUrl={match.team1_logo} />

        <div className="flex min-h-16 min-w-[5rem] items-center justify-center self-start sm:min-w-[6rem]">
          {showScore ? (
            <p
              className={cn(
                'leading-none tabular-nums',
                isLiveStripLayout
                  ? 'font-mono text-3xl font-bold tracking-[0.02em] sm:text-4xl'
                  : 'font-display text-4xl tracking-[0.02em] sm:text-5xl',
              )}
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
        className={cn(
          'relative mt-auto shrink-0 flex items-center justify-center gap-2 border-t pt-2 text-[10px] font-medium text-muted-foreground',
          resolvedCtaLabel && 'justify-between px-1',
          showMatchesTabPrediction && 'lg:justify-between lg:px-1',
          liveWatchMode && mode === 'live' && 'justify-center',
          footerBottomInset && 'lg:pb-5',
        )}
        style={{ borderColor: 'var(--match-card-footer-border)' }}
      >
        {liveWatchMode && mode === 'live' ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <Clock3
              className="h-3 w-3 shrink-0"
              style={{ color: 'var(--match-card-clock)' }}
              aria-hidden
            />
            <span
              className="truncate font-mono tabular-nums"
              suppressHydrationWarning
            >
              {liveClock ?? liveClockFallback ?? 'In progress'}
            </span>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-1.5">
              <Clock3
                className="h-3 w-3 shrink-0"
                style={{ color: 'var(--match-card-clock)' }}
                aria-hidden
              />
              <time dateTime={match.kickoff_at} suppressHydrationWarning className="truncate">
                {formatKickoff(match.kickoff_at)}
              </time>
            </div>
            <div
              className={cn(
                'flex shrink-0 items-center gap-2',
                showMatchesTabPrediction && 'hidden lg:contents',
              )}
            >
              {queuePicked ? (
                <span className="inline-flex items-center gap-0.5 font-semibold text-primary">
                  Picked
                  <span aria-hidden>✓</span>
                </span>
              ) : null}
              {resolvedCtaLabel ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-semibold',
                    queuePicked ? 'text-muted-foreground' : 'text-primary',
                  )}
                >
                  {resolvedCtaLabel}
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </span>
              ) : null}
            </div>
            {showMatchesTabPrediction && matchesTabPrediction && matchesTabActionHref ? (
              <MatchesTabPredictionFooter
                prediction={matchesTabPrediction}
                actionHref={matchesTabActionHref}
              />
            ) : null}
          </>
        )}
      </div>
    </article>
  )

  if (!cardNavigateHref) return body

  if (showMatchesTabPrediction) {
    return (
      <div className="relative block h-full rounded-2xl">
        <Link
          href={cardNavigateHref}
          className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label={`${match.team1_name} vs ${match.team2_name}. View match details`}
        />
        <div className="relative h-full">{body}</div>
      </div>
    )
  }

  return (
    <Link
      href={cardNavigateHref}
      className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      aria-label={
        resolvedCtaLabel
          ? `${match.team1_name} vs ${match.team2_name}. ${queuePicked ? 'Picked. ' : ''}${resolvedCtaLabel}`
          : `${match.team1_name} vs ${match.team2_name}. View match details`
      }
    >
      {body}
    </Link>
  )
}
