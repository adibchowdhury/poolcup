'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatarImage } from '@/components/user-avatar-image'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import {
  PoolDesktopCommissionerCta,
  PoolDesktopSidebarFrame,
  PoolDesktopSidebarLogo,
  PoolDesktopSidebarPoolNav,
  PoolDesktopSidebarSeparator,
  POOL_DESKTOP_SIDEBAR_SECTION_INSET_CLASS,
  poolDesktopSidebarSectionLabelClassName,
  usePoolDesktopSidebarCompactCta,
} from '@/components/pool/pool-desktop-sidebar-shared'
import { HUB_DESKTOP_SIDEBAR_WIDTH_CLASS } from '@/components/dashboard/hub-desktop-nav-frame'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { formatOrdinal } from '@/src/lib/analytics'
import { formatRelativeTimestamp } from '@/src/lib/points-transaction-feed'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'

/** @deprecated Prefer HUB_DESKTOP_SIDEBAR_WIDTH_CLASS — kept as alias for call sites. */
export const POOL_LEADERBOARD_SIDEBAR_WIDTH_CLASS = HUB_DESKTOP_SIDEBAR_WIDTH_CLASS

const infoRowLabelClassName = 'shrink-0 text-[11px] text-muted-foreground'
const infoRowValueClassName =
  'min-w-0 text-right text-[11px] font-medium text-foreground/90'

/** Step-5 review-card row grammar: label left, value right-aligned. */
function InfoFieldRow({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className={infoRowLabelClassName}>{label}</dt>
      <dd className={cn(infoRowValueClassName, valueClassName)}>{value}</dd>
    </div>
  )
}

/** Pool creation date — en-US short date (app date locale). */
function formatPoolCreatedDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Cap recent-activity rows so the fixed sidebar never needs to scroll.
 * Taller bottom CTA needs more room: short (~800px): 1 · mid: 2–3 · tall: 4.
 */
export function activityItemCapForViewportHeight(viewportHeight: number): number {
  if (viewportHeight < 840) return 1
  if (viewportHeight < 900) return 2
  if (viewportHeight < 1000) return 3
  return 4
}

function useActivityItemCap(): number {
  const [cap, setCap] = useState(4)

  useEffect(() => {
    function update() {
      setCap(activityItemCapForViewportHeight(window.innerHeight))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return cap
}

export type PoolLeaderboardShellPool = {
  name: string
  scoringStyle: string
  memberCount: number
  isPublic: boolean
  avatar: string | null
  emblemUrl: string | null
  /** pools.created_at — shown as Kickoff row (per product spec). */
  createdAt?: string | null
  nextMatchIn?: string | null
  nextMatchKickoffAt?: string | null
}

export type PoolLeaderboardActivityItem = {
  id: string
  name: string
  /** Empty string for guest/synthetic members (no profile link / user avatar). */
  userId: string
  avatar: string | null
  customAvatarUrl: string | null
  line: string
  /** Relative time when a real ISO timestamp exists; null when unknown. */
  timestampLabel: string | null
}

/**
 * Derive compact activity lines from real standings + join data only.
 * Sources: leaderboard_cache rank vs prev_rank (movement), pool_members.joined_at.
 * No fabricated events or timestamps.
 */
export function buildPoolLeaderboardActivity(
  members: LeaderboardMember[],
  maxItems = 4,
): PoolLeaderboardActivityItem[] {
  const safeName = (raw: string | null | undefined) => {
    const t = (raw ?? '').trim()
    return t || 'A member'
  }

  const moves: PoolLeaderboardActivityItem[] = members
    .filter((m) => m.movement === 'up' || m.movement === 'down')
    .filter((m) => m.rankDelta > 0)
    .sort((a, b) => b.rankDelta - a.rankDelta || a.rank - b.rank)
    .map((m) => {
      const name = safeName(m.name)
      const place = formatOrdinal(m.rank)
      return {
        id: `move-${m.id}`,
        name,
        userId: m.userId,
        avatar: m.avatar,
        customAvatarUrl: m.customAvatarUrl,
        line:
          m.movement === 'up'
            ? `${name} moved up to ${place}`
            : `${name} dropped to ${place}`,
        timestampLabel: null,
      }
    })

  const joins: PoolLeaderboardActivityItem[] = members
    .filter((m) => Boolean(m.joinedAt))
    .filter((m) => {
      const t = new Date(m.joinedAt ?? 0).getTime()
      if (Number.isNaN(t)) return false
      return Date.now() - t < 14 * 24 * 60 * 60 * 1000
    })
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.joinedAt ?? 0).getTime()
      const tb = new Date(b.joinedAt ?? 0).getTime()
      return tb - ta
    })
    .slice(0, maxItems)
    .map((m) => {
      const name = safeName(m.name)
      return {
        id: `join-${m.id}`,
        name,
        userId: m.userId,
        avatar: m.avatar,
        customAvatarUrl: m.customAvatarUrl,
        line: `${name} joined the pool`,
        timestampLabel: m.joinedAt
          ? formatRelativeTimestamp(m.joinedAt) || null
          : null,
      }
    })

  const seen = new Set<string>()
  const out: PoolLeaderboardActivityItem[] = []
  for (const item of [...moves, ...joins]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
    if (out.length >= maxItems) break
  }
  return out
}

export type PoolLeaderboardDesktopSidebarProps = {
  pool: PoolLeaderboardShellPool
  creatorName: string | null
  canInvite: boolean
  onInvite: () => void
  members: LeaderboardMember[]
  poolId?: string
  className?: string
}

/**
 * Desktop-only (lg+) leaderboard shell sidebar — viewport-fit, never scrolls.
 * Shared chrome: logo · POOL nav · Commissioner CTA (pool-desktop-sidebar-shared).
 */
export function PoolLeaderboardDesktopSidebar({
  pool,
  creatorName,
  canInvite,
  onInvite,
  members,
  poolId,
  className,
}: PoolLeaderboardDesktopSidebarProps) {
  const activityCap = useActivityItemCap()
  const activity = buildPoolLeaderboardActivity(members, activityCap)
  const compactCta = usePoolDesktopSidebarCompactCta(840)
  const kickoffLabel = formatPoolCreatedDate(pool.createdAt)
  const poolTypeLabel = formatScoringStyleLabel(pool.scoringStyle)

  return (
    <PoolDesktopSidebarFrame
      className={className}
      ariaLabel="Pool navigation and info"
    >
      <PoolDesktopSidebarLogo />
      <PoolDesktopSidebarSeparator />
      <PoolDesktopSidebarPoolNav />
      <PoolDesktopSidebarSeparator />

      <div
        className={cn(
          'flex shrink-0 flex-col gap-1.5 py-2.5',
          POOL_DESKTOP_SIDEBAR_SECTION_INSET_CLASS,
        )}
      >
        <p className={poolDesktopSidebarSectionLabelClassName}>Pool info</p>
        <p className="break-words text-base font-medium leading-snug whitespace-normal text-foreground">
          {pool.name}
        </p>
        <dl className="mt-0.5 flex flex-col gap-1.5">
          <InfoFieldRow
            label="Members"
            value={pool.memberCount}
            valueClassName="font-mono"
          />
          {creatorName ? (
            <InfoFieldRow
              label="Created by"
              value={creatorName}
              valueClassName="break-words"
            />
          ) : null}
          <InfoFieldRow label="Pool Type" value={poolTypeLabel} />
          {kickoffLabel ? (
            <InfoFieldRow label="Kickoff" value={kickoffLabel} />
          ) : null}
        </dl>

        {canInvite ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={onInvite}
            className={cn(
              'mt-0.5 h-8 w-full gap-1.5 px-2.5 text-xs',
              FOCUS_VISIBLE_RING,
            )}
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Invite members
          </Button>
        ) : null}
      </div>

      <PoolDesktopSidebarSeparator />

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-hidden py-2',
          POOL_DESKTOP_SIDEBAR_SECTION_INSET_CLASS,
        )}
      >
        <p className={poolDesktopSidebarSectionLabelClassName}>
          Recent activity
        </p>
        {activity.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground/70">
            No recent standings moves yet.
          </p>
        ) : (
          <ul className="flex min-h-0 flex-col gap-2 overflow-hidden">
            {activity.map((item) => (
              <li key={item.id} className="flex shrink-0 items-start gap-2.5">
                <UserAvatarImage
                  avatar={item.avatar}
                  customAvatarUrl={item.customAvatarUrl}
                  fallbackInitials={item.userId ? null : item.name}
                  fallbackColorKey={item.userId || item.name}
                  className="mt-0.5 h-8 w-8 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-xs leading-snug whitespace-normal text-foreground/90">
                    {item.line}
                  </p>
                  {item.timestampLabel ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {item.timestampLabel}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PoolDesktopCommissionerCta poolId={poolId} compact={compactCta} />
    </PoolDesktopSidebarFrame>
  )
}
