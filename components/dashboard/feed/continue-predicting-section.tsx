'use client'

import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

type ContinuePredictingSectionProps = {
  pools: DashboardPoolCardData[]
  loading?: boolean
}

function continuePredictHref(pool: DashboardPoolCardData): string {
  if (pool.scoringStyle === 'winner') {
    return `/pool/${pool.inviteCode}?tab=predictions`
  }
  return `/pool/${pool.inviteCode}/predict`
}

/**
 * Home CTA → next pool with upcoming unpredicted matches.
 * Hidden when nothing is left to predict.
 */
export function ContinuePredictingSection({
  pools,
  loading = false,
}: ContinuePredictingSectionProps) {
  if (loading) return null

  const actionable = pools
    .filter(
      (p) =>
        !p.predictionsLocked &&
        (p.picksNeeded ?? 0) > 0 &&
        p.nextMatchKickoffAt != null,
    )
    .sort((a, b) => {
      const aKick = a.nextMatchKickoffAt
        ? new Date(a.nextMatchKickoffAt).getTime()
        : Number.POSITIVE_INFINITY
      const bKick = b.nextMatchKickoffAt
        ? new Date(b.nextMatchKickoffAt).getTime()
        : Number.POSITIVE_INFINITY
      if (aKick !== bKick) return aKick - bKick
      return (b.picksNeeded ?? 0) - (a.picksNeeded ?? 0)
    })

  const target = actionable[0]
  if (!target) return null

  const totalPicksNeeded = actionable.reduce(
    (sum, p) => sum + (p.picksNeeded ?? 0),
    0,
  )
  const href = continuePredictHref(target)
  const picksLabel =
    totalPicksNeeded === 1 ? '1 pick needed' : `${totalPicksNeeded} picks needed`

  return (
    <DashboardFeedSection id="continue-predicting">
      <Link
        href={href}
        onClick={() => {
          capturePostHog('continue_predicting_clicked', {
            pool_id: target.id,
            picks_needed: totalPicksNeeded,
            pools_with_picks: actionable.length,
          })
        }}
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3.5 transition-colors hover:bg-primary/15',
          FOCUS_VISIBLE_RING,
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Zap className="h-5 w-5 fill-current" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg tracking-wide text-foreground">
            Continue Predicting
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {picksLabel}
            {actionable.length > 1
              ? ` across ${actionable.length} pools`
              : ` in ${target.name}`}
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      </Link>
    </DashboardFeedSection>
  )
}
