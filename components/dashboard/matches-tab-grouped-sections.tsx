'use client'

import { memo, useEffect, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DashboardPeekCarouselNav,
  DashboardPeekCarouselScroll,
  useDashboardPeekCarousel,
} from '@/components/dashboard/dashboard-peek-carousel'
import type { MatchesTabDateGroup } from '@/src/lib/matches-tab-date-groups'
import type { MatchesTabMatch } from '@/src/lib/fetch-matches-tab'
import { DASHBOARD_MATCHES_CAROUSEL_ITEM_CLASS } from '@/src/lib/dashboard-surfaces'

/** Matches tab grid gap-2.5 — same spacing in desktop carousel rows. */
const MATCHES_TAB_CAROUSEL_GAP_PX = 10

/** ≤ this many groups: mount all immediately (typical my-matches / filtered views). */
const MATCHES_TAB_STREAM_GROUP_THRESHOLD = 10
/** Large lists: first paint batch + per-frame streaming for 300-card case. */
const MATCHES_TAB_STREAM_INITIAL_COUNT = 6
const MATCHES_TAB_STREAM_GROUPS_PER_FRAME = 6

export function MatchesTabGroupHeader({
  label,
  count,
  showLiveDot = false,
  trailing,
  className,
  showCount = true,
  expanded,
  onToggle,
}: {
  label: string
  count: number
  showLiveDot?: boolean
  trailing?: ReactNode
  className?: string
  /** When false, hides the “N matches” count (e.g. predictions desktop). Default true. */
  showCount?: boolean
  /** Controlled expand state when `onToggle` is provided. */
  expanded?: boolean
  /** Makes the header a toggle control with chevron (app convention). */
  onToggle?: () => void
}) {
  const countLabel = count === 1 ? '1 match' : `${count} matches`
  const collapsible = typeof onToggle === 'function'
  const isExpanded = expanded ?? true

  const inner = (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {showLiveDot ? (
            <span
              className="h-2 w-2 animate-pulse rounded-full bg-secondary"
              aria-hidden
            />
          ) : null}
          <h2 className="font-display text-lg tracking-wide text-foreground uppercase sm:text-xl">
            {label}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2 pb-0.5">
          {showCount ? (
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {countLabel}
            </span>
          ) : null}
          {collapsible ? (
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-180',
              )}
              aria-hidden
            />
          ) : null}
          {trailing}
        </div>
      </div>
      <div
        className="mt-2 h-px w-full bg-gradient-to-r from-border via-border/70 to-transparent"
        aria-hidden
      />
    </>
  )

  if (collapsible) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={
          isExpanded ? `Collapse ${label} matches` : `Expand ${label} matches`
        }
        className={cn(
          'mb-2.5 w-full cursor-pointer text-left transition-colors',
          'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          className,
        )}
      >
        {inner}
      </button>
    )
  }

  return <div className={cn('mb-2.5', className)}>{inner}</div>
}

const MatchesTabGroupCarouselRow = memo(function MatchesTabGroupCarouselRow({
  group,
  getKey,
  renderItem,
  deferPaint = false,
}: {
  group: MatchesTabDateGroup
  getKey: (item: MatchesTabMatch) => string
  renderItem: (item: MatchesTabMatch, group: MatchesTabDateGroup) => ReactNode
  deferPaint?: boolean
}) {
  const {
    scrollRef,
    canScrollPrev,
    canScrollNext,
    scrollPrev,
    scrollNext,
  } = useDashboardPeekCarousel({
    gapPx: MATCHES_TAB_CAROUSEL_GAP_PX,
    measureScrollStepFromDom: true,
  })

  const showNav = canScrollPrev || canScrollNext

  return (
    <section
      aria-label={group.label}
      className={cn('min-w-0', deferPaint && '[content-visibility:auto]')}
    >
      <MatchesTabGroupHeader
        label={group.label}
        count={group.matches.length}
        showLiveDot={group.showLiveDot}
        trailing={
          showNav ? (
            <DashboardPeekCarouselNav
              canScrollPrev={canScrollPrev}
              canScrollNext={canScrollNext}
              onPrev={scrollPrev}
              onNext={scrollNext}
              prevAriaLabel={`Scroll ${group.label} left`}
              nextAriaLabel={`Scroll ${group.label} right`}
            />
          ) : null
        }
      />
      <DashboardPeekCarouselScroll
        scrollRef={scrollRef}
        trackClassName="gap-2.5"
        ariaLabel={`${group.label} matches`}
      >
        {group.matches.map((item) => (
          <div
            key={getKey(item)}
            role="listitem"
            data-peek-carousel-item
            className={DASHBOARD_MATCHES_CAROUSEL_ITEM_CLASS}
          >
            <div className="h-full w-full min-w-0 max-w-full">{renderItem(item, group)}</div>
          </div>
        ))}
      </DashboardPeekCarouselScroll>
    </section>
  )
})

type MatchesTabGroupedSectionsProps = {
  groups: MatchesTabDateGroup[]
  getKey: (item: MatchesTabMatch) => string
  renderItem: (item: MatchesTabMatch, group: MatchesTabDateGroup) => ReactNode
  className?: string
}

/** Desktop Matches tab — stacked date groups, each a horizontal peek carousel row. */
export function MatchesTabGroupedSections({
  groups,
  getKey,
  renderItem,
  className,
}: MatchesTabGroupedSectionsProps) {
  const shouldStream = groups.length > MATCHES_TAB_STREAM_GROUP_THRESHOLD
  const initialCount = shouldStream
    ? Math.min(groups.length, MATCHES_TAB_STREAM_INITIAL_COUNT)
    : groups.length
  const [renderCount, setRenderCount] = useState(initialCount)

  useEffect(() => {
    if (groups.length <= MATCHES_TAB_STREAM_GROUP_THRESHOLD) {
      setRenderCount(groups.length)
      return
    }

    const firstBatch = Math.min(groups.length, MATCHES_TAB_STREAM_INITIAL_COUNT)
    setRenderCount(firstBatch)

    let cancelled = false
    let next = firstBatch

    const pump = () => {
      if (cancelled || next >= groups.length) return
      requestAnimationFrame(() => {
        if (cancelled) return
        next = Math.min(
          next + MATCHES_TAB_STREAM_GROUPS_PER_FRAME,
          groups.length,
        )
        setRenderCount(next)
        if (next < groups.length) pump()
      })
    }

    pump()
    return () => {
      cancelled = true
    }
  }, [groups])

  if (groups.length === 0) return null

  const visibleGroups = groups.slice(0, renderCount)
  const isStreaming = shouldStream && renderCount < groups.length

  return (
    <div className={cn('space-y-6 lg:space-y-8', className)}>
      {visibleGroups.map((group, index) => (
        <MatchesTabGroupCarouselRow
          key={group.id}
          group={group}
          getKey={getKey}
          renderItem={renderItem}
          deferPaint={isStreaming && index >= MATCHES_TAB_STREAM_INITIAL_COUNT}
        />
      ))}
    </div>
  )
}
