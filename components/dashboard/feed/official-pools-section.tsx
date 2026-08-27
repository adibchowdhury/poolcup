'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Shield, Users } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  fetchOfficialPublicPools,
  formatOfficialStatusLabel,
  joinPublicPool,
  type OfficialPoolListItem,
} from '@/src/lib/fetch-official-pools'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'
import { getPoolAvatarSrc } from '@/src/lib/pool-avatars'
import { resolvePoolCardAccentColor } from '@/src/lib/pool-theme'
import { sportIconPng, isSportBallEmblemPath } from '@/src/lib/sport-display'
import { DASHBOARD_POOL_CARD_CLASS } from '@/src/lib/dashboard-surfaces'
import { supabase } from '@/src/lib/supabase'
import { capturePostHog } from '@/src/lib/posthog-client'
import { trackEvent } from '@/src/lib/track'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

/** Default card art — mobile poster only. */
const DEFAULT_OFFICIAL_POOL_BACKGROUND = '/background_01.png'

/** Desktop dashboard: max recommended pools (3 cols × up to 2 rows). */
const DASHBOARD_DISCOVER_DESKTOP_LIMIT = 6

/** Banner strip height (logo overlaps into body below). */
const DISCOVER_CARD_BANNER_H = 48

/**
 * Desktop card body stack (px):
 * pt-5 (20) + title h-5 (20) + meta gap (2) + meta h-4 (16) + footer mt (8)
 * + footer row max(stats 2-line ~40, button h-8 32) = 44 + pb-3 (12) = 122
 * + banner 48 = 170 total.
 */
const DASHBOARD_DISCOVER_DESKTOP_CARD_H = 170

const DASHBOARD_DISCOVER_DESKTOP_CARD_ROW = `${DASHBOARD_DISCOVER_DESKTOP_CARD_H}px`

/** Logo slot width (40px mark + 12px gap after pl-3 anchor). */
const DISCOVER_CARD_LOGO_CLEARANCE_PL = '3.5rem'

type OfficialPoolsSectionProps = {
  userId: string
  email: string
  /** Called after a successful join so "Your Pools" can refresh. */
  onJoined?: () => void
  desktopPanel?: boolean
}

export function OfficialPoolsSection({
  userId,
  email,
  onJoined,
  desktopPanel = false,
}: OfficialPoolsSectionProps) {
  const router = useRouter()
  const [pools, setPools] = useState<OfficialPoolListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joiningPoolId, setJoiningPoolId] = useState<string | null>(null)
  const [joinErrorByPool, setJoinErrorByPool] = useState<
    Record<string, string>
  >({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { pools: rows, error: fetchError } = await fetchOfficialPublicPools(
      supabase,
      userId,
    )
    setPools(rows)
    setError(fetchError)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleJoin(pool: OfficialPoolListItem) {
    if (joiningPoolId) return

    setJoiningPoolId(pool.id)
    setJoinErrorByPool((prev) => {
      const next = { ...prev }
      delete next[pool.id]
      return next
    })

    trackEvent('join_started', {
      poolId: pool.id,
      userId,
      metadata: { via: 'official_discover' },
    })

    const { error: joinError, alreadyMember } = await joinPublicPool(
      supabase,
      { id: userId, email },
      pool.id,
    )

    if (joinError) {
      setJoinErrorByPool((prev) => ({ ...prev, [pool.id]: joinError }))
      setJoiningPoolId(null)
      return
    }

    trackEvent('join_completed', {
      poolId: pool.id,
      userId,
      metadata: { via: 'official_discover', already_member: alreadyMember },
    })

    if (!alreadyMember) {
      capturePostHog('pool_joined', {
        pool_id: pool.id,
        via: 'official',
      })
    }

    setPools((prev) =>
      prev.map((p) =>
        p.id === pool.id
          ? {
              ...p,
              isMember: true,
              memberCount: alreadyMember ? p.memberCount : p.memberCount + 1,
            }
          : p,
      ),
    )
    setJoiningPoolId(null)
    onJoined?.()
    router.push(`/pool/${pool.inviteCode}`)
  }

  if (!loading && !error && pools.length === 0) {
    return null
  }

  const desktopPools = pools.slice(0, DASHBOARD_DISCOVER_DESKTOP_LIMIT)

  return (
    <DashboardFeedSection
      id="official-pools"
      title="Discover Pools"
      desktopPanel={desktopPanel}
      action={
        <Link
          href="/discover"
          className={cn(
            'rounded-sm text-xs font-medium text-primary hover:underline',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
        >
          Browse all
        </Link>
      }
    >
      {loading ? (
        <>
          <div
            className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-3"
            style={{ gridAutoRows: DASHBOARD_DISCOVER_DESKTOP_CARD_ROW }}
            aria-busy="true"
            aria-label="Discover pools"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <DesktopCardSkeleton key={index} />
            ))}
          </div>
          <div
            className={cn(
              '@container min-w-0 max-w-full w-full overflow-x-auto overscroll-x-contain lg:hidden',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            )}
            aria-busy="true"
          >
            <div
              className="grid min-w-0 grid-flow-col grid-rows-2 gap-2.5"
              style={{
                gridAutoColumns: 'calc((100cqw - 0.625rem) / 2)',
              }}
            >
              <MobileCardSkeleton />
              <MobileCardSkeleton />
              <MobileCardSkeleton />
              <MobileCardSkeleton />
            </div>
          </div>
        </>
      ) : error ? (
        <div className="rounded-xl border border-[#292929] bg-[#171717] px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className={cn(
              'mt-3 text-sm font-semibold text-primary underline-offset-4 hover:underline',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md',
            )}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div
            className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-3"
            style={{ gridAutoRows: DASHBOARD_DISCOVER_DESKTOP_CARD_ROW }}
            role="list"
            aria-label="Recommended pools"
          >
            {desktopPools.map((pool) => (
              <OfficialPoolCardDesktop
                key={pool.id}
                pool={pool}
                joining={joiningPoolId === pool.id}
                joinDisabled={joiningPoolId != null}
                joinError={joinErrorByPool[pool.id]}
                onJoin={() => void handleJoin(pool)}
              />
            ))}
          </div>

          <div
            className={cn(
              '@container min-w-0 max-w-full w-full overflow-x-auto overscroll-x-contain pb-0.5 lg:hidden',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              'snap-x snap-mandatory',
            )}
            role="list"
            aria-label="Official pools"
          >
            <div
              className="grid min-w-0 grid-flow-col grid-rows-2 gap-2.5"
              style={{
                gridAutoColumns: 'calc((100cqw - 0.625rem) / 2)',
              }}
            >
              {pools.map((pool) => (
                <OfficialPoolCardMobile
                  key={pool.id}
                  pool={pool}
                  backgroundImage={DEFAULT_OFFICIAL_POOL_BACKGROUND}
                  joining={joiningPoolId === pool.id}
                  joinDisabled={joiningPoolId != null}
                  joinError={joinErrorByPool[pool.id]}
                  onJoin={() => void handleJoin(pool)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </DashboardFeedSection>
  )
}

function seasonAlreadyInCopy(
  leagueName: string,
  poolName: string,
  seasonLabel: string | null,
): boolean {
  if (!seasonLabel?.trim()) return true
  const haystack = `${poolName} ${leagueName}`.toLowerCase()
  const year = seasonLabel.match(/\d{4}/)?.[0]
  if (year && haystack.includes(year)) return true
  return haystack.includes(seasonLabel.trim().toLowerCase())
}

function buildDiscoverMetadataLine(pool: OfficialPoolListItem): string {
  const format = formatScoringStyleLabel(pool.scoringStyle)
  let leaguePart = pool.leagueName
  if (
    pool.seasonLabel &&
    !seasonAlreadyInCopy(pool.leagueName, pool.name, pool.seasonLabel)
  ) {
    leaguePart = `${pool.leagueName} ${pool.seasonLabel}`
  }
  return `${leaguePart} · ${format}`
}

function isRemoteEmblemUrl(value: string | null | undefined): boolean {
  const trimmed = value?.trim()
  if (!trimmed) return false
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')
}

function DiscoverPoolLogo({
  pool,
  size,
}: {
  pool: OfficialPoolListItem
  size: number
}) {
  const markClassName = 'max-h-full max-w-full object-contain'
  const emblem = pool.emblemUrl?.trim() || null

  const shell = (
    inner: ReactNode,
  ) => (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#292929] bg-[#202020]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {inner}
    </div>
  )

  // Stored emblem is source of truth; sport-ball render remains a safety net.
  if (emblem && isRemoteEmblemUrl(emblem)) {
    return shell(
      // eslint-disable-next-line @next/next/no-img-element
      <img src={emblem} alt="" className={markClassName} />,
    )
  }

  if (emblem && isSportBallEmblemPath(emblem)) {
    return shell(
      <Image
        src={emblem}
        alt=""
        width={size}
        height={size}
        className={cn(markClassName, 'size-full')}
      />,
    )
  }

  const sportPng = pool.sport ? sportIconPng(pool.sport) : null
  if (sportPng) {
    return shell(
      <Image
        src={`/sports/${sportPng}`}
        alt=""
        width={size}
        height={size}
        className={cn(markClassName, 'size-full')}
      />,
    )
  }

  const presetSrc = getPoolAvatarSrc(pool.avatar)
  if (presetSrc) {
    return shell(
      <Image
        src={presetSrc}
        alt=""
        width={size}
        height={size}
        className={markClassName}
      />,
    )
  }

  return shell(<Shield className="h-5 w-5 text-muted-foreground" aria-hidden />)
}

function LiveStatusChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
        aria-hidden
      />
      Live
    </span>
  )
}

function StartsStatusChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#292929] bg-[#202020] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {label}
    </span>
  )
}

type OfficialPoolCardProps = {
  pool: OfficialPoolListItem
  joining: boolean
  joinDisabled: boolean
  joinError?: string
  onJoin: () => void
}

function OfficialPoolCardDesktop({
  pool,
  joining,
  joinDisabled,
  joinError,
  onJoin,
}: OfficialPoolCardProps) {
  const poolHref = `/pool/${pool.inviteCode}`
  const status = formatOfficialStatusLabel(
    pool.eventStatus,
    pool.eventStartDate,
  )
  const accent = resolvePoolCardAccentColor(pool.themeColor)
  const metadata = buildDiscoverMetadataLine(pool)
  const playersLabel = `${pool.memberCount} ${pool.memberCount === 1 ? 'player' : 'players'}`

  return (
    <article
      role="listitem"
      className={cn(
        DASHBOARD_POOL_CARD_CLASS,
        'relative flex h-full flex-col overflow-visible',
      )}
    >
      <Link
        href={poolHref}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`View ${pool.name}`}
      />
      <div className="relative z-10 flex h-full flex-col pointer-events-none">
        <div
          className="relative shrink-0 overflow-hidden rounded-t-2xl"
          style={{ height: DISCOVER_CARD_BANNER_H }}
        >
          <div
            className="absolute inset-0 bg-[#222222]"
            style={{
              backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${accent} 22%, #222222), #222222 55%)`,
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-white/[0.07] to-transparent"
            aria-hidden
          />
        </div>

        <div className="relative flex shrink-0 flex-col px-3 pb-3 pt-5">
          <div
            className="absolute left-3 top-0 z-10 -translate-y-1/2"
            aria-hidden
          >
            <DiscoverPoolLogo pool={pool} size={40} />
          </div>

          <div
            className="min-w-0 shrink-0"
            style={{ paddingLeft: DISCOVER_CARD_LOGO_CLEARANCE_PL }}
          >
            <h3
              className="h-5 min-w-0 truncate leading-5 font-display text-base font-semibold tracking-wide text-foreground"
              title={pool.name}
            >
              {pool.name}
            </h3>
            <p
              className="mt-0.5 h-4 min-w-0 truncate leading-4 text-xs text-muted-foreground"
              title={metadata}
            >
              {metadata}
            </p>
          </div>

          <div className="mt-2 flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                {playersLabel}
              </span>
              {status.kind === 'live' ? <LiveStatusChip /> : null}
              {status.kind === 'starts' && status.label ? (
                <StartsStatusChip label={status.label} />
              ) : null}
              {status.kind === 'ended' && status.label ? (
                <StartsStatusChip label={status.label} />
              ) : null}
            </div>

            {pool.isMember ? (
              <Button
                asChild
                size="sm"
                className={cn('pointer-events-auto shrink-0', FOCUS_VISIBLE_RING)}
              >
                <Link href={poolHref} onClick={(event) => event.stopPropagation()}>
                  Open →
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className={cn('pointer-events-auto shrink-0', FOCUS_VISIBLE_RING)}
                disabled={joining || joinDisabled}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onJoin()
                }}
              >
                {joining ? 'Joining…' : 'Join →'}
              </Button>
            )}
          </div>

          {joinError ? (
            <p className="pointer-events-auto mt-1 line-clamp-2 text-[11px] leading-snug text-destructive">
              {joinError}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}

type OfficialPoolCardMobileProps = OfficialPoolCardProps & {
  backgroundImage?: string
}

function OfficialVerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-primary text-primary-foreground shadow-[0_0_0_2px_rgba(0,0,0,0.35)]',
        className,
      )}
      title="Official PoolCup pool"
      aria-label="Official PoolCup pool"
    >
      <BadgeCheck className="h-[1.05em] w-[1.05em]" strokeWidth={2.25} aria-hidden />
    </span>
  )
}

/** Mobile poster card — unchanged layout (lg:hidden wrapper in parent). */
function OfficialPoolCardMobile({
  pool,
  backgroundImage = DEFAULT_OFFICIAL_POOL_BACKGROUND,
  joining,
  joinDisabled,
  joinError,
  onJoin,
}: OfficialPoolCardMobileProps) {
  const status = formatOfficialStatusLabel(
    pool.eventStatus,
    pool.eventStartDate,
  )
  const playersLabel = `${pool.memberCount} ${pool.memberCount === 1 ? 'player' : 'players'}`
  const typeLabel = formatScoringStyleLabel(pool.scoringStyle)
  const typePillStyle =
    pool.scoringStyle === 'winner'
      ? {
          color: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.10)',
          border: '1px solid rgba(245,158,11,0.35)',
        }
      : {
          color: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.10)',
          border: '1px solid rgba(34,197,94,0.35)',
        }

  return (
    <article
      role="listitem"
      className={cn(
        'relative flex aspect-[3/4] min-h-0 snap-start flex-col overflow-hidden',
        'rounded-3xl border border-white/15',
        'shadow-[0_8px_28px_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.06)_inset]',
      )}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div
        className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black/55 via-black/20 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col justify-between">
        <div className="min-w-0 px-3 pt-3.5 sm:px-3.5 sm:pt-4">
          <div className="flex min-w-0 items-start gap-1.5 sm:gap-2">
            <h3
              className={cn(
                'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
                'text-lg font-bold leading-tight tracking-tight text-white',
                'sm:text-2xl sm:leading-[1.05]',
              )}
              title={pool.leagueName}
            >
              {pool.leagueName}
            </h3>
            <OfficialVerifiedBadge className="mt-0.5 h-5 w-5 shrink-0 sm:mt-1 sm:h-7 sm:w-7" />
          </div>

          <span
            className="mt-1.5 inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide sm:mt-2 sm:px-3 sm:py-1 sm:text-xs"
            style={typePillStyle}
          >
            {typeLabel}
          </span>

          <div className="mt-2 flex flex-col items-start gap-1 text-sm font-semibold text-white/85 sm:mt-2.5 sm:text-base">
            {pool.seasonLabel &&
            !seasonAlreadyInCopy(pool.leagueName, pool.name, pool.seasonLabel) ? (
              <span className="block">{pool.seasonLabel}</span>
            ) : null}
            {status.kind !== 'none' && status.label ? (
              <span
                className={cn(
                  'flex items-center gap-1.5',
                  status.kind === 'live' && 'font-bold text-primary',
                )}
              >
                {status.kind === 'live' ? (
                  <span
                    className="stage-live-dot h-2 w-2 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                ) : null}
                {status.label}
              </span>
            ) : null}
          </div>

          {joinError ? (
            <p className="mt-2 text-xs text-rose-300 sm:text-sm">{joinError}</p>
          ) : null}
        </div>

        <div
          className={cn(
            'flex flex-col gap-2 border-t border-white/10',
            'bg-black/50 px-3 py-2.5 backdrop-blur-[2px] sm:px-3.5 sm:py-3',
          )}
        >
          <p className="inline-flex w-full items-center gap-1.5 text-sm font-semibold tabular-nums text-white/90">
            <Users className="h-4 w-4 shrink-0 opacity-85" aria-hidden />
            <span>{playersLabel}</span>
          </p>

          <span className="sr-only">Free entry</span>

          {pool.isMember ? (
            <Link
              href={`/pool/${pool.inviteCode}`}
              className={cn(
                'block w-full rounded-full px-3 py-1.5 text-center text-sm font-semibold',
                'bg-white/15 text-white transition-colors hover:bg-white/25',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              Open →
            </Link>
          ) : (
            <button
              type="button"
              disabled={joining || joinDisabled}
              onClick={onJoin}
              className={cn(
                'w-full rounded-full px-3 py-1.5 text-center text-sm font-semibold',
                'bg-primary text-primary-foreground transition-colors hover:bg-primary/90',
                'disabled:pointer-events-none disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              {joining ? 'Joining…' : 'Join →'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function DesktopCardSkeleton() {
  return (
    <div
      className="h-full animate-pulse overflow-hidden rounded-2xl border border-[#292929] bg-[#171717]"
      aria-hidden
    >
      <div className="h-12 bg-[#222222]" />
      <div className="space-y-2 px-3 pt-6 pb-3">
        <div className="h-4 w-3/4 rounded bg-[#222222]" />
        <div className="h-3 w-1/2 rounded bg-[#222222]" />
        <div className="mt-4 flex justify-between">
          <div className="h-3 w-24 rounded bg-[#222222]" />
          <div className="h-8 w-16 rounded-md bg-[#222222]" />
        </div>
      </div>
    </div>
  )
}

function MobileCardSkeleton() {
  return (
    <div
      className="aspect-[3/4] animate-pulse rounded-3xl border border-[#292929] bg-[#171717] shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
      aria-hidden
    />
  )
}
