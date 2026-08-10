'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Users } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { cn } from '@/lib/utils'
import {
  fetchOfficialPublicPools,
  formatOfficialStatusLabel,
  formatPlayerCountLabel,
  joinPublicPool,
  type OfficialPoolListItem,
} from '@/src/lib/fetch-official-pools'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'
import { supabase } from '@/src/lib/supabase'
import { capturePostHog } from '@/src/lib/posthog-client'
import { trackEvent } from '@/src/lib/track'

/** Default card art — swap per league later via `backgroundImage` on each card. */
const DEFAULT_OFFICIAL_POOL_BACKGROUND = '/background_01.png'

type OfficialPoolsSectionProps = {
  userId: string
  email: string
  /** Called after a successful join so "Your Pools" can refresh. */
  onJoined?: () => void
}

export function OfficialPoolsSection({
  userId,
  email,
  onJoined,
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
    return (
      <DashboardFeedSection id="official-pools" title="Discover Pools">
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No official pools to discover right now
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Create your own pool or join a friend with an invite code.
          </p>
          <Link
            href="/create"
            className={cn(
              'mt-4 inline-flex rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            )}
          >
            Create a pool
          </Link>
        </div>
      </DashboardFeedSection>
    )
  }

  return (
    <DashboardFeedSection id="official-pools" title="Discover Pools">
      {loading ? (
        <div
          className={cn(
            '@container w-full overflow-x-auto',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
          aria-busy="true"
          aria-label="Discover pools"
        >
          <div
            className="grid grid-flow-col grid-rows-2 gap-2.5"
            style={{
              gridAutoColumns: 'calc((100cqw - 0.625rem) / 2)',
            }}
          >
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card/50 px-4 py-6 text-center">
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
        <div
          className={cn(
            '@container w-full overflow-x-auto pb-0.5',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'snap-x snap-mandatory',
          )}
          role="list"
          aria-label="Official pools"
        >
          <div
            className="grid grid-flow-col grid-rows-2 gap-2.5"
            style={{
              gridAutoColumns: 'calc((100cqw - 0.625rem) / 2)',
            }}
          >
            {pools.map((pool) => (
              <OfficialPoolCard
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
      )}
    </DashboardFeedSection>
  )
}

type OfficialPoolCardProps = {
  pool: OfficialPoolListItem
  /** Per-card art URL (all use background_01 for now; swap per league later). */
  backgroundImage?: string
  joining: boolean
  joinDisabled: boolean
  joinError?: string
  onJoin: () => void
}

/**
 * Original verified mark — check in a circle (brand green).
 * Not a league logo or trademarked badge.
 */
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

function OfficialPoolCard({
  pool,
  backgroundImage = DEFAULT_OFFICIAL_POOL_BACKGROUND,
  joining,
  joinDisabled,
  joinError,
  onJoin,
}: OfficialPoolCardProps) {
  const status = formatOfficialStatusLabel(
    pool.eventStatus,
    pool.eventStartDate,
  )
  const playersLabel = formatPlayerCountLabel(pool.memberCount)
  const typeLabel = formatScoringStyleLabel(pool.scoringStyle)
  /** Match PoolCard `getPoolTypePillTheme` (Your Pools) for consistency. */
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
      {/* Full-card dark scrim (~60%) so large white type pops; keep artwork visible underneath */}
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      {/* Extra bottom weight for the title block + bar */}
      <div
        className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black/55 via-black/20 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col justify-between">
        {/* League identity stays anchored at the top-left. */}
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
            {pool.seasonLabel ? <span className="block">{pool.seasonLabel}</span> : null}
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

        {/* Bottom stack: full player count, then a full-width Join/Open action. */}
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

          {/* Reserved for future entry fee, e.g. "1 🎟️ Entry ·" — free for now */}
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

function CardSkeleton() {
  return (
    <div
      className="aspect-[3/4] animate-pulse rounded-3xl border border-border/60 bg-muted/40 shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
      aria-hidden
    />
  )
}
