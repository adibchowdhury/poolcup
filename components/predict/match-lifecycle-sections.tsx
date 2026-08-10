'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  MATCH_LIFECYCLE_SECTION_LABEL,
  MATCH_LIFECYCLE_SECTION_ORDER,
  type MatchLifecycleSectionId,
} from '@/src/lib/match-lifecycle-section'

export function MatchLifecycleSectionHeader({
  sectionId,
  count,
  className,
}: {
  sectionId: MatchLifecycleSectionId
  count: number
  className?: string
}) {
  const label = MATCH_LIFECYCLE_SECTION_LABEL[sectionId]
  const countLabel = count === 1 ? '1 match' : `${count} matches`

  return (
    <div className={cn('mb-2.5', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          {sectionId === 'live' ? (
            <span
              className="h-2 w-2 animate-pulse rounded-full bg-secondary"
              aria-hidden
            />
          ) : null}
          <h2 className="font-display text-lg tracking-wide text-foreground uppercase sm:text-xl">
            {label}
          </h2>
        </div>
        <span className="shrink-0 pb-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {countLabel}
        </span>
      </div>
      <div
        className="mt-2 h-px w-full bg-gradient-to-r from-border via-border/70 to-transparent"
        aria-hidden
      />
    </div>
  )
}

type MatchLifecycleSectionsProps<T> = {
  buckets: Record<MatchLifecycleSectionId, T[]>
  getKey: (item: T) => string
  renderItem: (item: T, sectionId: MatchLifecycleSectionId) => ReactNode
  emptyFallback?: ReactNode
  listClassName?: string
  className?: string
}

export function MatchLifecycleSections<T>({
  buckets,
  getKey,
  renderItem,
  emptyFallback,
  listClassName,
  className,
}: MatchLifecycleSectionsProps<T>) {
  const nonEmpty = MATCH_LIFECYCLE_SECTION_ORDER.filter(
    (id) => buckets[id].length > 0,
  )

  if (nonEmpty.length === 0) {
    return <>{emptyFallback ?? null}</>
  }

  return (
    <div className={cn('space-y-6', className)}>
      {nonEmpty.map((sectionId) => (
        <section
          key={sectionId}
          aria-label={MATCH_LIFECYCLE_SECTION_LABEL[sectionId]}
        >
          <MatchLifecycleSectionHeader
            sectionId={sectionId}
            count={buckets[sectionId].length}
          />
          <ul className={listClassName}>
            {buckets[sectionId].map((item) => (
              <li key={getKey(item)} className="min-w-0">
                {renderItem(item, sectionId)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
