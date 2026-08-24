'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useClientNow } from '@/hooks/use-client-now'
import { useFitText } from '@/hooks/use-fit-text'
import {
  ArrowRight,
  Check,
  Copy,
  MoreVertical,
  Shield,
  Target,
  Trophy,
  UserPlus,
  Zap,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { ordinalPlace } from '@/components/pool/leaderboard-grouped-list'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'
import {
  getPoolLeaderboardHref,
} from '@/src/lib/pool-unread-counts'
import { trackEvent } from '@/src/lib/track'
import { useAuth } from '@/src/lib/auth-context'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  DASHBOARD_POOL_CARD_CLASS,
} from '@/src/lib/dashboard-surfaces'
import { resolvePoolCardAccentColor } from '@/src/lib/pool-theme'
import { getPoolAvatarSrc } from '@/src/lib/pool-avatars'
import { sportIconPng, isSportBallEmblemPath } from '@/src/lib/sport-display'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { bindTactilePress } from '@/src/lib/tactile-press'

export type PoolMemberAvatar = {
  displayName: string
  /** @deprecated Prefer avatar + customAvatarUrl; kept optional for mobile consumers. */
  initials?: string
  avatar?: string | null
  customAvatarUrl?: string | null
}

export type ScoringStyleId = 'winner' | 'classic' | 'exact' // exact: legacy DB pools only

export type RankMovement = 'up' | 'down' | 'none'

export type DashboardPoolCardData = {
  id: string
  name: string
  eventName: string
  scoringStyle: ScoringStyleId | string
  inviteCode: string
  members: number
  memberAvatars: PoolMemberAvatar[]
  yourRank: number | null
  /** Direction from leaderboard_cache prev_rank vs rank. */
  movement: RankMovement
  /** Absolute place change (|prev_rank - rank|); 0 when none. */
  rankDelta: number
  totalPredictions: number
  yourPredictions: number
  /**
   * Upcoming matches (horizon) still missing a prediction for this member.
   * Winner pools: remaining group/knockout progress slots when unlocked.
   */
  picksNeeded?: number
  nextMatchKickoffAt: string | null
  predictionsLocked: boolean
  canDelete?: boolean
  /** PoolCup-generated official event pool (vs invite/user pool). */
  isOfficial?: boolean
  /** pools.theme_color — top accent strip + micro-accents when set. */
  themeColor?: string | null
  /** Preset squad photo under /pool_avatars. */
  avatar?: string | null
  /** Custom uploaded emblem URL. */
  emblemUrl?: string | null
  /** sporting_events.sport — official pool logo on desktop. */
  sport?: string | null
}

const MAX_VISIBLE_MEMBER_AVATARS = 4

const POOL_CARD_ACCENT_STRIP_PX = 3

/**
 * Desktop lg+ logo band — locked height for uniform 23.5rem grid rows.
 * 376px row − 3 accent − ~72px header − ~155px body − ~54px actions ≈ 92px.
 */
const POOL_CARD_DESKTOP_LOGO_ZONE_H = 92

/** Vertical inset inside the logo band (top + bottom each). */
const POOL_CARD_DESKTOP_LOGO_ZONE_PY = 10

/** Reserved medal row so body height stays fixed when rank is outside top 3. */
const POOL_CARD_MEDAL_SLOT_MIN_H = 28

const POOL_CARD_OPEN_BTN_CLASS =
  'ui-tactile-btn ui-tactile-btn--primary inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium has-[>svg]:px-2.5'

function poolLogoAccentGlowStyle(accent: string): CSSProperties {
  return {
    background: `radial-gradient(ellipse 75% 85% at 50% 45%, color-mix(in srgb, ${accent} 16%, transparent), transparent 72%)`,
  }
}

function isRemoteEmblemUrl(value: string | null | undefined): boolean {
  const trimmed = value?.trim()
  if (!trimmed) return false
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')
}

function PoolCardLogoMark({ pool }: { pool: DashboardPoolCardData }) {
  const markClassName = 'max-h-full max-w-full object-contain'
  const emblem = pool.emblemUrl?.trim() || null
  const [emblemFailed, setEmblemFailed] = useState(false)

  useEffect(() => {
    setEmblemFailed(false)
  }, [emblem])

  // Stored emblem is source of truth (official pools store /sports/*.png).
  if (emblem && isRemoteEmblemUrl(emblem) && !emblemFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Supabase public emblem URL
      <img
        src={emblem}
        alt=""
        className={markClassName}
        onError={() => setEmblemFailed(true)}
      />
    )
  }

  if (emblem && isSportBallEmblemPath(emblem) && !emblemFailed) {
    return (
      <Image
        src={emblem}
        alt=""
        width={120}
        height={120}
        className={markClassName}
        sizes="(min-width: 1024px) 320px"
        onError={() => setEmblemFailed(true)}
      />
    )
  }

  // Safety net: official pools without a stored emblem still get the sport ball.
  if (pool.isOfficial) {
    const png = pool.sport ? sportIconPng(pool.sport) : null
    if (png) {
      return (
        <Image
          src={`/sports/${png}`}
          alt=""
          width={120}
          height={120}
          className={markClassName}
          sizes="(min-width: 1024px) 320px"
        />
      )
    }
    return <Shield className="h-12 w-12 text-muted-foreground" aria-hidden />
  }

  const presetSrc = getPoolAvatarSrc(pool.avatar)
  if (presetSrc) {
    return (
      <Image
        src={presetSrc}
        alt=""
        width={160}
        height={120}
        className={markClassName}
        sizes="(min-width: 1024px) 320px"
      />
    )
  }

  return <Shield className="h-12 w-12 text-muted-foreground" aria-hidden />
}

function PoolCardDesktopLogoZone({
  pool,
  accentColor,
}: {
  pool: DashboardPoolCardData
  accentColor: string
}) {
  return (
    <div
      className="relative hidden w-full shrink-0 lg:block"
      style={{ height: POOL_CARD_DESKTOP_LOGO_ZONE_H }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={poolLogoAccentGlowStyle(accentColor)}
      />
      <div
        className="relative box-border flex h-full w-full flex-col px-[15px]"
        style={{ paddingTop: POOL_CARD_DESKTOP_LOGO_ZONE_PY, paddingBottom: POOL_CARD_DESKTOP_LOGO_ZONE_PY }}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <PoolCardLogoMark pool={pool} />
        </div>
      </div>
    </div>
  )
}

function poolAccentBorder(accent: string, mix = 40): string {
  return `color-mix(in srgb, ${accent} ${mix}%, transparent)`
}

function poolAccentPillStyle(accent: string): CSSProperties {
  return {
    color: accent,
    backgroundColor: poolAccentBorder(accent, 11),
    borderColor: poolAccentBorder(accent, 30),
  }
}

function getLegacyTypePillStyle(scoringStyle: string): CSSProperties {
  if (scoringStyle === 'winner') {
    return {
      color: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.10)',
      borderColor: 'rgba(245,158,11,0.35)',
    }
  }
  return {
    color: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.35)',
  }
}

const RANK_MEDAL_CHIP: Record<
  1 | 2 | 3,
  { emoji: string; backgroundColor: string; color: string }
> = {
  1: { emoji: '🥇', backgroundColor: '#e3b341', color: '#3a2a00' },
  2: { emoji: '🥈', backgroundColor: '#b9bfc9', color: '#20242b' },
  3: { emoji: '🥉', backgroundColor: '#c47a3d', color: '#301606' },
}

function RankMedalChip({ place }: { place: number | null }) {
  if (place == null || place > 3) return null

  const medal = RANK_MEDAL_CHIP[place as 1 | 2 | 3]
  if (!medal) return null

  return (
    <div className="mt-1">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-xs font-medium whitespace-nowrap"
        style={{
          backgroundColor: medal.backgroundColor,
          color: medal.color,
        }}
      >
        <span aria-hidden>{medal.emoji}</span>
        Currently in {ordinalPlace(place)} place
      </span>
    </div>
  )
}

interface PoolCardProps {
  pool: DashboardPoolCardData
  onPoolDeleted?: (poolId: string) => void
  /**
   * Card chrome only. `dashboard` = calm neutral surface + theme accent strip.
   * `default` = flat bg-card (landing preview).
   */
  surface?: 'default' | 'dashboard' | 'outline'
  /**
   * Marketing / landing preview: all CTAs navigate here instead of in-app pool
   * routes. Hides delete + invite-copy side effects (safe on logged-out pages).
   */
  previewActionHref?: string
  /** Dashboard grid: hide invite-friends row. */
  hideInviteFriends?: boolean
  /** Dashboard grid: fixed height + single-line shrinking title. */
  uniformSize?: boolean
}

const POOL_CARD_NEUTRAL_SURFACE_CLASS = DASHBOARD_POOL_CARD_CLASS

const POOL_CARD_SURFACE_CLASS = {
  default: 'overflow-hidden rounded-2xl border border-border/90 bg-card/90',
  dashboard: POOL_CARD_NEUTRAL_SURFACE_CLASS,
  outline: POOL_CARD_NEUTRAL_SURFACE_CLASS,
} as const

export function PoolCard({
  pool,
  onPoolDeleted,
  surface = 'dashboard',
  previewActionHref,
  hideInviteFriends = false,
  uniformSize = false,
}: PoolCardProps) {
  const isPreview = Boolean(previewActionHref)
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const deleteTriggerRef = useRef<HTMLDivElement>(null)
  const { mounted, nowMs } = useClientNow(1000)
  const TypeIcon = pool.scoringStyle === 'winner' ? Trophy : Target
  const typeLabel = formatScoringStyleLabel(pool.scoringStyle)
  const accentColor = resolvePoolCardAccentColor(pool.themeColor)
  const usesDashboardChrome = surface === 'dashboard' || surface === 'outline'
  const totalMatches = pool.totalPredictions > 0 ? pool.totalPredictions : 72
  const progressPercent =
    totalMatches > 0 ? (pool.yourPredictions / totalMatches) * 100 : 0
  const predictionsComplete =
    totalMatches > 0 && pool.yourPredictions >= totalMatches
  const nextKickoffMs = pool.nextMatchKickoffAt
    ? new Date(pool.nextMatchKickoffAt).getTime()
    : null
  const showPredictButton = isPreview
    ? !pool.predictionsLocked && nextKickoffMs != null
    : mounted &&
      !pool.predictionsLocked &&
      nextKickoffMs != null &&
      nextKickoffMs > nowMs
  const poolHref = `/pool/${pool.inviteCode}`
  const predictButtonHref = isPreview
    ? previewActionHref!
    : pool.scoringStyle === 'winner'
      ? `/pool/${pool.inviteCode}?tab=predictions`
      : poolHref
  const nameHref = isPreview ? previewActionHref! : poolHref
  const leaderboardHref = isPreview
    ? previewActionHref!
    : getPoolLeaderboardHref(pool.inviteCode)
  const visibleAvatars = pool.memberAvatars.slice(0, MAX_VISIBLE_MEMBER_AVATARS)
  const overflowCount = Math.max(0, pool.members - MAX_VISIBLE_MEMBER_AVATARS)
  const playersLabel = `${pool.members} ${pool.members === 1 ? 'player' : 'players'}`
  const picksNeeded = Math.max(0, pool.picksNeeded ?? 0)
  const showPicksNeededBadge =
    !isPreview && showPredictButton && picksNeeded > 0

  const titleFit = useFitText<HTMLHeadingElement>({
    maxSize: 24,
    minSize: 14,
    deps: [pool.name, uniformSize],
  })

  const copyCode = () => {
    if (isPreview) return
    const joinUrl = buildJoinInviteUrl(
      window.location.origin,
      pool.inviteCode,
      user?.id,
    )
    void import('@/src/lib/share-client').then(({ shareOrCopy }) => {
      capturePostHog('share_card_generated', { type: 'pool_invite' })
      void shareOrCopy({
        title: `Join ${pool.name} on PoolCup`,
        text: 'Join my prediction pool on PoolCup',
        url: joinUrl,
        imageUrl: `/api/share/pool/${encodeURIComponent(pool.inviteCode)}`,
        type: 'pool_invite',
      })
        .then(() => {
          trackEvent('invite_link_copied', {
            poolId: pool.id,
            metadata: { source: 'dashboard_card' },
          })
          capturePostHog('invite_link_copied', { pool_id: pool.id })
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => {
          void navigator.clipboard.writeText(joinUrl)
          trackEvent('invite_link_copied', {
            poolId: pool.id,
            metadata: { source: 'dashboard_card' },
          })
          capturePostHog('invite_link_copied', { pool_id: pool.id })
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        })
    })
  }

  const openDeleteDialog = () => {
    deleteTriggerRef.current?.querySelector('button')?.click()
  }

  return (
    <div
      className={cn(
        'dashboard-pool-card rounded-2xl',
        uniformSize && 'h-full min-h-0',
      )}
    >
      <div
        className={cn(
          POOL_CARD_SURFACE_CLASS[surface],
          uniformSize && 'flex h-full min-h-0 flex-col overflow-hidden',
        )}
      >
        {usesDashboardChrome ? (
          <div
            className="w-full shrink-0"
            style={{
              height: POOL_CARD_ACCENT_STRIP_PX,
              backgroundColor: accentColor,
            }}
            aria-hidden
          />
        ) : null}
      <div
        className={cn(
          'shrink-0 border-b border-border px-[15px] py-[13px]',
          uniformSize && 'min-h-[4.5rem]',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold"
                style={
                  usesDashboardChrome
                    ? poolAccentPillStyle(accentColor)
                    : getLegacyTypePillStyle(pool.scoringStyle)
                }
              >
                <TypeIcon
                  className="h-3 w-3 shrink-0"
                  style={
                    usesDashboardChrome
                      ? { color: accentColor }
                      : {
                          color: getLegacyTypePillStyle(pool.scoringStyle).color,
                        }
                  }
                  aria-hidden
                />
                {typeLabel}
              </span>
              <span
                className={cn(
                  'inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  usesDashboardChrome
                    ? 'border-[#292929] bg-[#202020] text-muted-foreground'
                    : 'border-border/80 bg-muted/30 text-muted-foreground',
                )}
              >
                {pool.isOfficial ? 'Official' : 'Invite'}
              </span>
              {showPicksNeededBadge ? (
                <span
                  className="inline-flex w-fit items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                  aria-label={
                    picksNeeded === 1
                      ? '1 pick needed'
                      : `${picksNeeded} picks needed`
                  }
                >
                  {picksNeeded === 1
                    ? '1 pick needed'
                    : `${picksNeeded} picks needed`}
                </span>
              ) : null}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Trophy
                className="h-3 w-3 shrink-0 text-muted-foreground/80"
                aria-hidden
              />
              <span className="truncate">{pool.eventName}</span>
            </p>
          </div>

          {!isPreview && pool.canDelete ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Pool options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(event) => {
                      event.preventDefault()
                      openDeleteDialog()
                    }}
                  >
                    Delete pool
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div ref={deleteTriggerRef} className="sr-only" aria-hidden>
                <DeletePoolDialog
                  poolId={pool.id}
                  poolName={pool.name}
                  redirectTo="/dashboard"
                  onDeleted={() => onPoolDeleted?.(pool.id)}
                  iconOnly
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 px-[15px] pt-[14px]">
        <Link href={nameHref} className="block min-w-0">
          <h3
            ref={uniformSize ? titleFit.ref : undefined}
            className={cn(
              'min-w-0 font-display tracking-wide text-foreground transition-colors hover:text-primary',
              uniformSize
                ? 'h-8 truncate leading-none'
                : 'text-2xl',
            )}
            style={
              uniformSize
                ? { fontSize: `${titleFit.fontSize}px` }
                : undefined
            }
            title={pool.name}
          >
            {pool.name}
          </h3>
        </Link>

        <div className="mt-2.5 min-h-[1.75rem]">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {visibleAvatars.map((member, index) => (
                <UserAvatarImage
                  key={`${member.displayName}-${index}`}
                  avatar={member.avatar}
                  customAvatarUrl={member.customAvatarUrl}
                  alt={member.displayName}
                  className={cn(
                    'h-[26px] w-[26px] border-2 ring-2',
                    usesDashboardChrome
                      ? 'border-[#171717] ring-[#171717]'
                      : 'border-card ring-card',
                    index > 0 && '-ml-[7px]',
                  )}
                />
              ))}
              {overflowCount > 0 ? (
                <div
                  className={cn(
                    '-ml-[7px] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-primary ring-2',
                    usesDashboardChrome
                      ? 'border-[#171717] bg-[#222222] ring-[#171717]'
                      : 'border-card bg-[#1a2535] ring-card',
                  )}
                  aria-label={`${overflowCount} more players`}
                >
                  +{overflowCount}
                </div>
              ) : null}
            </div>
            <span className="text-sm text-muted-foreground">{playersLabel}</span>
          </div>
          <div
            className={cn(
              'mt-1',
              uniformSize && usesDashboardChrome && 'min-h-[28px]',
            )}
          >
            <RankMedalChip place={pool.yourRank} />
          </div>
        </div>

        <div className="mt-3.5">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Your predictions</span>
            <span className="font-mono text-primary">
              {pool.yourPredictions} / {totalMatches}
            </span>
          </div>
          <div
            className={cn(
              'h-[7px] overflow-hidden rounded-full',
              usesDashboardChrome ? 'bg-[#222222]' : 'bg-muted',
            )}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {usesDashboardChrome ? (
        <PoolCardDesktopLogoZone pool={pool} accentColor={accentColor} />
      ) : null}

      <div className="shrink-0 px-[15px] pb-[14px] max-lg:mt-3">
        <div className="flex flex-nowrap gap-2">
          {showPredictButton ? (
            <Link
              href={predictButtonHref}
              className={cn(
                'inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-primary px-2.5 py-[11px] text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-3',
                FOCUS_VISIBLE_RING,
              )}
            >
              <Zap className="h-4 w-4 shrink-0 fill-current" aria-hidden />
              <span className="truncate">
                {predictionsComplete ? 'Update Predictions' : 'Predict Now'}
              </span>
            </Link>
          ) : null}
          <Link
            href={leaderboardHref}
            onPointerDown={
              usesDashboardChrome
                ? (event) => bindTactilePress(event.currentTarget)
                : undefined
            }
            className={cn(
              usesDashboardChrome
                ? POOL_CARD_OPEN_BTN_CLASS
                : cn(
                    'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-border bg-transparent px-2.5 py-[11px] text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-3',
                    'hover:bg-muted',
                  ),
              FOCUS_VISIBLE_RING,
              showPredictButton ? undefined : 'w-full',
            )}
          >
            Open Pool
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        </div>

        {isPreview ? (
          <Link
            href={previewActionHref!}
            className={cn(
              'relative mt-2 flex w-full items-center gap-2 overflow-hidden rounded-[10px] border border-border bg-transparent px-3 py-1.5 text-left transition-colors',
              usesDashboardChrome ? 'hover:bg-[#1d1d1d]' : 'hover:bg-muted',
              FOCUS_VISIBLE_RING,
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent animate-join-cta-shimmer motion-reduce:hidden"
            />
            <UserPlus className="relative h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="relative flex-1 text-sm font-medium text-primary">
              Get started
            </span>
            <ArrowRight className="relative h-4 w-4 shrink-0 text-primary" aria-hidden />
          </Link>
        ) : hideInviteFriends ? null : (
          <button
            type="button"
            onClick={copyCode}
            className={cn(
              'mt-2 flex w-full items-center gap-2 rounded-[10px] border border-border bg-transparent px-3 py-1.5 text-left transition-colors',
              usesDashboardChrome ? 'hover:bg-[#1d1d1d]' : 'hover:bg-muted',
              FOCUS_VISIBLE_RING,
            )}
          >
            <UserPlus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="flex-1 text-sm font-medium text-primary">
              Invite friends
            </span>
            <code className="font-mono text-sm text-foreground">{pool.inviteCode}</code>
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground"
              aria-hidden
            >
              {copied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Copy className="h-4 w-4 hover:text-foreground" />
              )}
            </span>
          </button>
        )}
      </div>
      </div>
    </div>
  )
}
