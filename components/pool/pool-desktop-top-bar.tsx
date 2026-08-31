'use client'

import { Globe, Lock, Settings, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { useReportIssue } from '@/components/report-issue-dialog'
import { cn } from '@/lib/utils'
import { POOL_DESKTOP_CHROME_SURFACE_CLASS } from '@/src/lib/dashboard-surfaces'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'

/**
 * Shared pool desktop top bar (leaderboard + predictions).
 * All identity/actions are explicit props — no React context.
 * Consumers: PoolHomeView on desktop shell tabs.
 */
export const POOL_DESKTOP_TOPBAR_AVATAR_PX = 56

/** Shared content gutters — top bar + main column cards (lg+). */
export const POOL_DESKTOP_CONTENT_RAIL_CLASS = 'w-full lg:px-6 xl:px-8'

/** @deprecated Prefer POOL_DESKTOP_TOPBAR_AVATAR_PX */
export const POOL_LEADERBOARD_TOPBAR_AVATAR_PX = POOL_DESKTOP_TOPBAR_AVATAR_PX
/** @deprecated Prefer POOL_DESKTOP_CONTENT_RAIL_CLASS */
export const POOL_LEADERBOARD_DESKTOP_CONTENT_RAIL_CLASS =
  POOL_DESKTOP_CONTENT_RAIL_CLASS

/** Settings tactile fill — dignified violet; edge via --tactile-btn-surface mix. */
export const POOL_DESKTOP_SETTINGS_SURFACE = '#7C3AED'
/** @deprecated Prefer POOL_DESKTOP_SETTINGS_SURFACE */
export const POOL_LEADERBOARD_SETTINGS_SURFACE = POOL_DESKTOP_SETTINGS_SURFACE

/** Gear icon tile — matches `POOL_DESKTOP_TOPBAR_AVATAR_PX` footprint in settings context. */
export const POOL_DESKTOP_TOPBAR_SETTINGS_ICON_TILE_CLASS =
  'flex shrink-0 items-center justify-center rounded-xl border border-[#292929] bg-[#1c1c1c] shadow-[0_4px_12px_rgba(0,0,0,0.18)]'

export type PoolDesktopTopBarContext = 'pool' | 'settings'

const actionBtnClassName = cn('h-8 gap-1.5 px-2.5 text-xs', FOCUS_VISIBLE_RING)
const actionIconClassName = 'h-3.5 w-3.5'

export type PoolDesktopTopBarActionsProps = {
  canInvite: boolean
  onInvite: () => void
  className?: string
}

/** @deprecated Prefer PoolDesktopTopBarActionsProps */
export type PoolLeaderboardDesktopTopBarActionsProps = PoolDesktopTopBarActionsProps

/**
 * RIGHT-aligned action cluster.
 * Order: Report issue (red) → Invite (green primary).
 */
export function PoolDesktopTopBarActions({
  canInvite,
  onInvite,
  className,
}: PoolDesktopTopBarActionsProps) {
  const { openReportIssue } = useReportIssue()

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-end gap-2.5',
        className,
      )}
    >
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={openReportIssue}
        aria-label="Report issue"
        className={actionBtnClassName}
      >
        Report issue
      </Button>
      {canInvite ? (
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={onInvite}
          className={actionBtnClassName}
        >
          <UserPlus className={actionIconClassName} aria-hidden />
          Invite
        </Button>
      ) : null}
    </div>
  )
}

/** @deprecated Prefer PoolDesktopTopBarActions */
export const PoolLeaderboardDesktopTopBarActions = PoolDesktopTopBarActions

export type PoolDesktopTopBarProps = {
  /**
   * `'pool'` (default): pool avatar + pool name.
   * `'settings'`: gear tile + "Pool Settings"; metadata omits pool name.
   */
  context?: PoolDesktopTopBarContext
  poolName: string
  scoringStyle: string
  memberCount: number
  isPublic: boolean
  avatar: string | null
  emblemUrl: string | null
  canInvite: boolean
  onInvite: () => void
  className?: string
}

/** @deprecated Prefer PoolDesktopTopBarProps */
export type PoolLeaderboardDesktopTopBarProps = PoolDesktopTopBarProps

function PoolDesktopTopBarMetadata({
  poolTypeLabel,
  memberLabel,
  isPublic,
  visibilityLabel,
  VisibilityIcon,
}: {
  poolTypeLabel: string
  memberLabel: string
  isPublic: boolean
  visibilityLabel: string
  VisibilityIcon: typeof Globe
}) {
  const dot = (
    <span className="text-muted-foreground/40" aria-hidden>
      ·
    </span>
  )

  return (
    <div className="mt-1 flex min-w-0 items-center gap-2.5 text-[13px] leading-none text-muted-foreground">
      <span className="shrink-0 truncate">{poolTypeLabel}</span>
      {dot}
      <span className="inline-flex shrink-0 items-center gap-1.5 truncate">
        <Users className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        {memberLabel}
      </span>
      {dot}
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
        <VisibilityIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            isPublic ? 'text-[#22d3ee]' : 'text-[#a78bfa]',
          )}
          strokeWidth={2}
          aria-hidden
        />
        <span className="truncate">{visibilityLabel}</span>
      </span>
    </div>
  )
}

/**
 * Desktop-only sticky top bar for pool shell pages (predictions, leaderboard, settings).
 * `h-20`; no bottom border — spacing separates bar from content.
 */
export function PoolDesktopTopBar({
  context = 'pool',
  poolName,
  scoringStyle,
  memberCount,
  isPublic,
  avatar,
  emblemUrl,
  canInvite,
  onInvite,
  className,
}: PoolDesktopTopBarProps) {
  const poolTypeLabel = formatScoringStyleLabel(scoringStyle)
  const memberLabel =
    memberCount === 1 ? '1 member' : `${memberCount} members`
  const visibilityLabel = isPublic ? 'Public pool' : 'Private pool'
  const VisibilityIcon = isPublic ? Globe : Lock
  const isSettings = context === 'settings'
  const title = isSettings ? 'Pool Settings' : poolName

  return (
    <header
      className={cn(
        'sticky top-0 z-30 hidden shrink-0 backdrop-blur-xl lg:block',
        POOL_DESKTOP_CHROME_SURFACE_CLASS,
        className,
      )}
      aria-label={isSettings ? 'Pool settings header' : 'Pool page header'}
    >
      <div
        className={cn(
          'flex h-20 w-full items-center justify-between gap-5',
          POOL_DESKTOP_CONTENT_RAIL_CLASS,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {isSettings ? (
            <div
              className={POOL_DESKTOP_TOPBAR_SETTINGS_ICON_TILE_CLASS}
              style={{
                width: POOL_DESKTOP_TOPBAR_AVATAR_PX,
                height: POOL_DESKTOP_TOPBAR_AVATAR_PX,
              }}
              aria-hidden
            >
              <Settings
                className="h-7 w-7 text-primary"
                strokeWidth={2}
              />
            </div>
          ) : (
            <PoolAvatarImage
              avatar={avatar}
              emblemUrl={emblemUrl}
              pixelSize={POOL_DESKTOP_TOPBAR_AVATAR_PX}
              size="sm"
              className="shrink-0 rounded-xl"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-left font-display text-3xl leading-tight tracking-wide text-foreground">
              {title}
            </h1>
            <PoolDesktopTopBarMetadata
              poolTypeLabel={poolTypeLabel}
              memberLabel={memberLabel}
              isPublic={isPublic}
              visibilityLabel={visibilityLabel}
              VisibilityIcon={VisibilityIcon}
            />
          </div>
        </div>
        <PoolDesktopTopBarActions
          canInvite={canInvite}
          onInvite={onInvite}
        />
      </div>
    </header>
  )
}

/** @deprecated Prefer PoolDesktopTopBar */
export const PoolLeaderboardDesktopTopBar = PoolDesktopTopBar
