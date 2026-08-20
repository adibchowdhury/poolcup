'use client'

import type { ReactNode } from 'react'
import {
  groupMlsPlayoffMatchesByStage,
  type MlsPlayoffStageGroup,
} from '@/src/lib/mls-playoff-rounds'

export function MlsPlayoffStageSections<T extends { round: string }>({
  items,
  getKickoffMs,
  getKey,
  renderMatch,
  emptyFallback,
}: {
  items: T[]
  getKickoffMs: (item: T) => number
  getKey: (item: T) => string
  renderMatch: (item: T, stage: MlsPlayoffStageGroup<T>) => ReactNode
  emptyFallback?: ReactNode
}) {
  const groups = groupMlsPlayoffMatchesByStage(items, getKickoffMs)

  if (groups.length === 0) {
    return (
      <>
        {emptyFallback ?? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No playoff matches scheduled yet.
          </p>
        )}
      </>
    )
  }

  return (
    <div className="space-y-8">
      {groups.map((stage) => (
        <section key={stage.round} aria-label={stage.label} className="space-y-3">
          <div>
            <h2 className="font-display text-lg tracking-wide text-foreground uppercase sm:text-xl">
              {stage.label}
            </h2>
            <div
              className="mt-2 h-px w-full bg-gradient-to-r from-border via-border/70 to-transparent"
              aria-hidden
            />
          </div>
          <div className="flex flex-col gap-3">
            {stage.matches.map((item) => (
              <div key={getKey(item)}>{renderMatch(item, stage)}</div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
