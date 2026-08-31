'use client'

import type { CSSProperties } from 'react'
import { Globe, Lock, Settings, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { useReportIssue } from '@/components/report-issue-dialog'
import { cn } from '@/lib/utils'
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

const actionBtnClassName = cn('h-8 gap-1.5 px-2.5 text-xs', FOCUS_VISIBLE_RING)
const actionIconClassName = 'h-3.5 w-3.5'

const settingsTactileStyle = {
  '--tactile-btn-surface': POOL_DESKTOP_SETTINGS_SURFACE,
  border: 'none',
  color: '#ffffff',
  background: `linear-gradient(180deg, color-mix(in srgb, ${POOL_DESKTOP_SETTINGS_SURFACE} 78%, #ffffff), ${POOL_DESKTOP_SETTINGS_SURFACE})`,
} as CSSProperties

export type PoolDesktopTopBarActionsProps = {
  canInvite: boolean
  onInvite: () => void
  onSettings: () => void
  className?: string
}

/** @deprecated Prefer PoolDesktopTopBarActionsProps */
export type PoolLeaderboardDesktopTopBarActionsProps = PoolDesktopTopBarActionsProps

/**
 * RIGHT-aligned action cluster.
 * Order: Report issue (red) → Settings (purple) → Invite (green primary).
 */
export function PoolDesktopTopBarActions({
  canInvite,
  onInvite,
  onSettings,
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
      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={onSettings}
        aria-label="Pool settings"
        className={actionBtnClassName}
        style={settingsTactileStyle}
      >
        <Settings className={actionIconClassName} aria-hidden />
        Settings
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
  poolName: string
  scoringStyle: string
  memberCount: number
  isPublic: boolean
  avatar: string | null
  emblemUrl: string | null
  canInvite: boolean
  onInvite: () => void
  onSettings: () => void
  className?: string
}

/** @deprecated Prefer PoolDesktopTopBarProps */
export type PoolLeaderboardDesktopTopBarProps = PoolDesktopTopBarProps

/**
 * Desktop-only sticky top bar for pool shell pages (predictions + leaderboard).
 * `h-20`; no bottom border — spacing separates bar from content.
 */
export function PoolDesktopTopBar({
  poolName,
  scoringStyle,
  memberCount,
  isPublic,
  avatar,
  emblemUrl,
  canInvite,
  onInvite,
  onSettings,
  className,
}: PoolDesktopTopBarProps) {
  const poolTypeLabel = formatScoringStyleLabel(scoringStyle)
  const memberLabel =
    memberCount === 1 ? '1 member' : `${memberCount} members`
  const visibilityLabel = isPublic ? 'Public pool' : 'Private pool'
  const VisibilityIcon = isPublic ? Globe : Lock

  return (
    <header
      className={cn(
        'sticky top-0 z-30 hidden shrink-0 bg-app-background/95 backdrop-blur-xl lg:block',
        className,
      )}
      aria-label="Pool page header"
    >
      <div
        className={cn(
          'flex h-20 w-full items-center justify-between gap-5',
          POOL_DESKTOP_CONTENT_RAIL_CLASS,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <PoolAvatarImage
            avatar={avatar}
            emblemUrl={emblemUrl}
            pixelSize={POOL_DESKTOP_TOPBAR_AVATAR_PX}
            size="sm"
            className="shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-left font-display text-3xl leading-tight tracking-wide text-foreground">
              {poolName}
            </h1>
            <div className="mt-1 flex min-w-0 items-center gap-2.5 text-[13px] leading-none text-muted-foreground">
              <span className="shrink-0 truncate">{poolTypeLabel}</span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 truncate">
                <Users className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                {memberLabel}
              </span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
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
          </div>
        </div>
        <PoolDesktopTopBarActions
          canInvite={canInvite}
          onInvite={onInvite}
          onSettings={onSettings}
        />
      </div>
    </header>
  )
}

/** @deprecated Prefer PoolDesktopTopBar */
export const PoolLeaderboardDesktopTopBar = PoolDesktopTopBar
