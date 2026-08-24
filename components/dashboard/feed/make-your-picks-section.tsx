'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { JoinOrCreatePoolCard } from '@/components/dashboard/join-or-create-pool-card'
import {
  DashboardPeekCarouselNav,
  DashboardPeekCarouselScroll,
  dashboardPeekCarouselItemClass,
  useDashboardPeekCarousel,
} from '@/components/dashboard/dashboard-peek-carousel'
import {
  MakeYourPicksRailCard,
  MakeYourPicksRailCardSkeletonList,
} from '@/components/dashboard/feed/make-your-picks-rail-card'
import { PremiumMatchCard } from '@/components/dashboard/premium-match-card'
import { Button } from '@/components/ui/button'
import { formatPicksQueueSubline } from '@/src/lib/make-your-picks-countdown'
import {
  useMakeYourPicksQueue,
  useMakeYourPicksQueueOptional,
  type MakeYourPicksQueueState,
} from '@/hooks/use-make-your-picks-queue'
import { useClientNow } from '@/hooks/use-client-now'
import {
  DASHBOARD_MATCHES_MINE_HREF,
  DASHBOARD_TAB_HREFS,
} from '@/src/lib/mobile-bottom-nav-routes'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

const QUEUE_CARD_ITEM_CLASS =
  'w-[min(85cqi,20rem)] shrink-0 overflow-hidden sm:w-[22rem]'

const QUEUE_CARD_ITEM_CLASS_DESKTOP = dashboardPeekCarouselItemClass(
  QUEUE_CARD_ITEM_CLASS,
)

/** Desktop rail preview — compact queue, not a scrollable feed. */
const RAIL_PREVIEW_MATCH_LIMIT = 6

type MakeYourPicksSectionProps = {
  userId?: string
  /** Carousel for mobile; vertical compact list for desktop rail. */
  surface?: 'carousel' | 'rail'
  className?: string
}

function queueEventLabel(eventName: string): string | null {
  const trimmed = eventName.trim()
  if (!trimmed || trimmed.toLowerCase() === 'competition') return null
  return trimmed
}

function QueueCardSkeleton() {
  return (
    <div
      className={`${QUEUE_CARD_ITEM_CLASS_DESKTOP} h-[12.25rem] animate-pulse rounded-[1.4rem] border border-border/60 bg-muted/40`}
      aria-hidden
    />
  )
}

function MakeYourPicksSectionView({
  surface = 'carousel',
  className,
  loading,
  matches,
  hasPools,
  error,
  pickedMatchIds,
  reload,
}: Omit<MakeYourPicksSectionProps, 'userId'> & MakeYourPicksQueueState) {
  const {
    scrollRef,
    scrollStyle,
    canScrollPrev,
    canScrollNext,
    scrollPrev,
    scrollNext,
  } = useDashboardPeekCarousel()

  const { mounted, nowMs } = useClientNow(60_000)

  const subline = useMemo(() => {
    if (!mounted) return null
    return formatPicksQueueSubline(matches, pickedMatchIds, nowMs)
  }, [mounted, nowMs, matches, pickedMatchIds])

  const previewMatches = useMemo(
    () =>
      surface === 'rail'
        ? matches.slice(0, RAIL_PREVIEW_MATCH_LIMIT)
        : matches,
    [matches, surface],
  )

  const hasMorePreview =
    surface === 'rail' && matches.length > RAIL_PREVIEW_MATCH_LIMIT

  const showCaughtUp =
    !loading && hasPools && matches.length === 0 && pickedMatchIds.size === 0

  const showQueue = !loading && matches.length > 0
  const showCarouselNav = surface === 'carousel' && showQueue && matches.length > 1

  const headerTitleClass =
    surface === 'rail'
      ? 'font-display text-lg leading-none tracking-wide text-foreground'
      : 'font-display text-xl leading-none tracking-wide text-foreground'

  const matchesTabHref = DASHBOARD_MATCHES_MINE_HREF
  const browseMatchesHref = DASHBOARD_TAB_HREFS.upcoming

  return (
    <section
      data-feed-section="make-your-picks"
      data-surface={surface}
      className={cn('min-w-0 space-y-3', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={headerTitleClass}>Make Your Picks</h2>
          {subline ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{subline}</p>
          ) : null}
        </div>
        {surface === 'rail' && showQueue ? (
          <Link
            href={matchesTabHref}
            className={cn(
              'shrink-0 text-xs font-semibold text-primary hover:underline',
              FOCUS_VISIBLE_RING,
              'rounded-sm',
            )}
          >
            View all →
          </Link>
        ) : showCarouselNav ? (
          <DashboardPeekCarouselNav
            canScrollPrev={canScrollPrev}
            canScrollNext={canScrollNext}
            onPrev={scrollPrev}
            onNext={scrollNext}
            prevAriaLabel="Scroll picks left"
            nextAriaLabel="Scroll picks right"
          />
        ) : null}
      </div>

      {loading ? (
        surface === 'rail' ? (
          <MakeYourPicksRailCardSkeletonList count={5} />
        ) : (
          <DashboardPeekCarouselScroll
            scrollRef={scrollRef}
            scrollStyle={scrollStyle}
            className="-mx-1 px-1 pb-1"
            trackClassName="gap-3"
            ariaLabel="Loading picks queue"
          >
            <QueueCardSkeleton />
            <QueueCardSkeleton />
            <QueueCardSkeleton />
          </DashboardPeekCarouselScroll>
        )
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-5 text-center">
          <p className="text-sm text-destructive">
            Could not load your prediction queue.
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => void reload()}
          >
            Try again
          </button>
        </div>
      ) : !hasPools ? (
        <JoinOrCreatePoolCard />
      ) : showCaughtUp ? (
        <div
          className={cn(
            'rounded-2xl border border-primary/25 bg-primary/5 text-center',
            surface === 'rail' ? 'px-4 py-5' : 'px-4 py-4',
          )}
        >
          {surface === 'rail' ? (
            <>
              <CheckCircle2
                className="mx-auto h-5 w-5 text-primary"
                aria-hidden
              />
              <p className="mt-2 font-display text-base tracking-wide text-foreground">
                All caught up
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Every open match has a prediction.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex max-w-sm flex-col items-center gap-1.5">
                <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
                <p className="font-display text-lg tracking-wide text-foreground">
                  You&apos;re all caught up
                </p>
                <p className="text-sm text-muted-foreground">
                  New matches will appear here as they&apos;re scheduled.
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5 rounded-full"
              >
                <Link href={browseMatchesHref}>
                  Browse matches
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </>
          )}
        </div>
      ) : showQueue ? (
        surface === 'rail' ? (
          <div className="space-y-2" role="list" aria-label="Matches needing predictions">
            {previewMatches.map((match) => {
              const picked = pickedMatchIds.has(match.id)
              return (
                <div key={match.id} role="listitem">
                  <MakeYourPicksRailCard
                    match={match}
                    picked={picked}
                    poolNames={match.pools_needing_names}
                    href={`/match/${match.id}`}
                  />
                </div>
              )
            })}
            {hasMorePreview ? (
              <Link
                href={matchesTabHref}
                className={cn(
                  'inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary hover:underline',
                  FOCUS_VISIBLE_RING,
                  'rounded-sm',
                )}
              >
                View all picks
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
        ) : (
          <DashboardPeekCarouselScroll
            scrollRef={scrollRef}
            scrollStyle={scrollStyle}
            className="-mx-1 px-1 pb-1"
            trackClassName="gap-3"
            ariaLabel="Matches needing predictions"
          >
            {matches.map((match) => {
              const picked = pickedMatchIds.has(match.id)
              return (
                <div
                  key={match.id}
                  role="listitem"
                  className={QUEUE_CARD_ITEM_CLASS_DESKTOP}
                >
                  <PremiumMatchCard
                    match={match}
                    mode="upcoming"
                    competitionName={queueEventLabel(match.event_name)}
                    href={`/match/${match.id}`}
                    showQueueCountdown
                    queueMode
                    queuePoolNames={match.pools_needing_names}
                    queuePicked={picked}
                    predictCtaLabel="Predict"
                  />
                </div>
              )
            })}
          </DashboardPeekCarouselScroll>
        )
      ) : null}
    </section>
  )
}

function MakeYourPicksSectionWithFetch({
  userId,
  ...props
}: MakeYourPicksSectionProps & { userId: string }) {
  const queue = useMakeYourPicksQueue(userId)
  return <MakeYourPicksSectionView {...props} {...queue} />
}

export function MakeYourPicksSection({
  userId,
  ...props
}: MakeYourPicksSectionProps) {
  const fromContext = useMakeYourPicksQueueOptional()

  if (fromContext) {
    return <MakeYourPicksSectionView {...props} {...fromContext} />
  }

  if (!userId) {
    throw new Error(
      'MakeYourPicksSection requires userId when not wrapped in MakeYourPicksQueueProvider',
    )
  }

  return <MakeYourPicksSectionWithFetch userId={userId} {...props} />
}
