'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_CARD_HOVER_CLASS,
  DASHBOARD_FEED_SURFACE_CLASS,
} from '@/src/lib/dashboard-surfaces'
import { getTeamInitials } from '@/components/dashboard/premium-match-card'
import { isTeamLogoUrl } from '@/src/lib/team-logos'
import {
  formatPickLockCountdownLabel,
  type PickLockCountdownTier,
} from '@/src/lib/make-your-picks-countdown'
import { sportIconPng } from '@/src/lib/sport-display'
import { useClientNow } from '@/hooks/use-client-now'
import type { MakeYourPicksMatch } from '@/src/lib/fetch-make-your-picks-queue'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

type MakeYourPicksRailCardProps = {
  match: MakeYourPicksMatch
  picked: boolean
  poolNames: string[]
  href: string
}

const RAIL_TEAM_LOGO_PX = 28
const RAIL_SPORT_ICON_PX = 16

function RailPoolContext({ poolNames }: { poolNames: string[] }) {
  if (poolNames.length === 0) return null

  if (poolNames.length === 1) {
    return (
      <p className="min-w-0 truncate text-[11px] text-muted-foreground">
        {poolNames[0]}
      </p>
    )
  }

  return (
    <p
      className="min-w-0 truncate text-[11px] text-muted-foreground"
      title={poolNames.join(', ')}
    >
      {poolNames[0]} +{poolNames.length - 1}
    </p>
  )
}

function RailSportIcon({ sport }: { sport: string | null }) {
  const png = sport ? sportIconPng(sport) : null
  if (!png) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#222222] text-[9px] font-bold text-muted-foreground"
        style={{ width: RAIL_SPORT_ICON_PX, height: RAIL_SPORT_ICON_PX }}
        aria-hidden
      >
        ·
      </span>
    )
  }

  return (
    <Image
      src={`/sports/${png}`}
      alt=""
      width={RAIL_SPORT_ICON_PX}
      height={RAIL_SPORT_ICON_PX}
      style={{ width: 'auto', height: 'auto' }}
      className="shrink-0 object-contain"
      aria-hidden
    />
  )
}

function RailTeamMark({
  name,
  logoUrl,
}: {
  name: string
  logoUrl?: string | null
}) {
  const crestSrc = isTeamLogoUrl(logoUrl) ? logoUrl!.trim() : null

  if (crestSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={crestSrc}
        alt=""
        className="shrink-0 object-contain"
        style={{ width: RAIL_TEAM_LOGO_PX, height: RAIL_TEAM_LOGO_PX }}
      />
    )
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-[#292929] bg-[#222222] text-[10px] font-bold text-foreground"
      style={{ width: RAIL_TEAM_LOGO_PX, height: RAIL_TEAM_LOGO_PX }}
    >
      {getTeamInitials(name).slice(0, 2)}
    </span>
  )
}

const COUNTDOWN_TIER_CLASS: Record<PickLockCountdownTier, string> = {
  muted: 'text-muted-foreground',
  default: 'text-foreground',
  urgent: 'font-semibold text-[#ffb300]',
}

function RailPickCountdown({ lockAt }: { lockAt: string }) {
  const { mounted, nowMs } = useClientNow(30_000)
  const countdown = mounted
    ? formatPickLockCountdownLabel(lockAt, nowMs)
    : null

  return (
    <span
      className={cn(
        'shrink-0 text-[11px] tabular-nums',
        countdown
          ? COUNTDOWN_TIER_CLASS[countdown.tier]
          : 'text-muted-foreground',
      )}
      suppressHydrationWarning
    >
      {countdown?.label ?? '—'}
    </span>
  )
}

export function MakeYourPicksRailCard({
  match,
  picked,
  poolNames,
  href,
}: MakeYourPicksRailCardProps) {
  const lockAt = match.locked_at ?? match.kickoff_at
  const { mounted, nowMs } = useClientNow(30_000)
  const tier =
    mounted && lockAt
      ? formatPickLockCountdownLabel(lockAt, nowMs)?.tier ?? 'default'
      : 'default'
  const isUrgent = tier === 'urgent'

  return (
    <article
      className={cn(
        DASHBOARD_FEED_SURFACE_CLASS,
        DASHBOARD_CARD_HOVER_CLASS,
        'px-3 py-2.5',
        isUrgent &&
          'border-l-2 border-l-[#ffb300]/70 bg-[#ffb300]/[0.05] hover:bg-[#ffb300]/[0.05]',
        picked && !isUrgent && 'border-primary/30 bg-primary/[0.06] hover:bg-primary/[0.06]',
      )}
    >
      <div className="flex items-center gap-2">
        <RailSportIcon sport={match.sport} />
        <Link
          href={href}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5',
            FOCUS_VISIBLE_RING,
            'rounded-sm',
          )}
        >
          <RailTeamMark name={match.team1_name} logoUrl={match.team1_logo} />
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
            {match.team1_name}
          </span>
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
            vs
          </span>
          <RailTeamMark name={match.team2_name} logoUrl={match.team2_logo} />
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
            {match.team2_name}
          </span>
        </Link>
        <RailPickCountdown lockAt={lockAt} />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 pl-[calc(16px+0.5rem)]">
        <div className="min-w-0 flex-1">
          <RailPoolContext poolNames={poolNames} />
        </div>
        {picked ? (
          <Link
            href={href}
            className={cn(
              'shrink-0 text-xs font-semibold text-primary hover:underline',
              FOCUS_VISIBLE_RING,
              'rounded-sm',
            )}
          >
            Edit →
          </Link>
        ) : (
          <Button
            asChild
            size="sm"
            className={cn('h-7 shrink-0 px-2.5 text-xs', FOCUS_VISIBLE_RING)}
          >
            <Link href={href}>Predict →</Link>
          </Button>
        )}
      </div>
    </article>
  )
}

function MakeYourPicksRailCardSkeleton() {
  return (
    <div
      className="h-[4.75rem] animate-pulse rounded-xl border border-[#292929] bg-[#171717]"
      aria-hidden
    />
  )
}

export function MakeYourPicksRailCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <MakeYourPicksRailCardSkeleton key={index} />
      ))}
    </div>
  )
}
