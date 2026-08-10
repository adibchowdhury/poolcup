'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  BiggestCommunityClimbCard,
  ClosestCallCard,
  GlobalActivitySkeleton,
  MostPredictedCard,
} from '@/components/dashboard/feed/global-activity-section'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/src/lib/auth-context'
import {
  fetchGlobalActivityFeed,
  type GlobalActivityFeedData,
} from '@/src/lib/fetch-global-activity-feed'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'

/**
 * Full community activity highlights (linked from dashboard "View All").
 */
export function ActivityPageView() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<GlobalActivityFeedData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const next = await fetchGlobalActivityFeed(supabase, user.id)
    setData(next)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?next=/activity')
      return
    }
    void load()
  }, [authLoading, user, router, load])

  if (authLoading || !user) {
    return (
      <main
        className={cn(
          'flex min-h-screen items-center justify-center bg-background',
          MOBILE_BOTTOM_NAV_PAD_CLASS,
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const hasCards = Boolean(
    data?.mostPredicted ||
      data?.closestCall ||
      data?.biggestCommunityClimb,
  )

  return (
    <main
      className={cn(
        'min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          <h1 className="mt-3 font-display text-2xl tracking-wide text-foreground sm:text-3xl">
            Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Community highlights across PoolCup — predictions, close calls, and
            climbs.
          </p>
        </div>

        <DashboardPlainCard className="p-3 sm:p-4">
          {loading && !data ? (
            <GlobalActivitySkeleton rows={3} />
          ) : data?.error && data.isEmpty ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn’t load activity.
              </p>
              <p className="text-xs text-destructive/90">{data.error}</p>
              <Button
                type="button"
                variant="outline"
                className="focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => void load()}
              >
                Try again
              </Button>
            </div>
          ) : data?.isEmpty || !data || !hasCards ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No community highlights yet. Predictions and leaderboard
              movements will show up here.
            </p>
          ) : (
            <div className="space-y-2">
              {data.mostPredicted ? (
                <MostPredictedCard match={data.mostPredicted} />
              ) : null}
              {data.closestCall ? (
                <ClosestCallCard item={data.closestCall} />
              ) : null}
              {data.biggestCommunityClimb ? (
                <BiggestCommunityClimbCard item={data.biggestCommunityClimb} />
              ) : null}
            </div>
          )}
        </DashboardPlainCard>
      </div>
    </main>
  )
}
