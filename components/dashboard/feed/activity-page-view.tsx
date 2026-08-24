'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  GlobalActivityItemCard,
  GlobalActivitySkeleton,
} from '@/components/dashboard/feed/global-activity-section'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/src/lib/auth-context'
import { fetchGlobalActivityFeed } from '@/src/lib/fetch-global-activity-feed'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { cn } from '@/lib/utils'

/**
 * Full community activity list (linked from dashboard "View All").
 */
export function ActivityPageView() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchGlobalActivityFeed>
  > | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const next = await fetchGlobalActivityFeed(user.id, { scope: 'page' })
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
            Pool Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate activity across PoolCup — picks, joins, new pools, and
            upcoming matches.
          </p>
        </div>

        <DashboardPlainCard className="p-3 sm:p-4">
          {loading && !data ? (
            <GlobalActivitySkeleton rows={3} />
          ) : data?.error && data.isEmpty ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load activity.
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
          ) : data?.isEmpty ? (
            <div className="space-y-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No recent pool activity yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Quiet right now — be the first to make your picks.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data?.items.map((item) => (
                <GlobalActivityItemCard key={item.id} item={item} />
              ))}
              {data?.isSparse ? (
                <p className="pt-2 text-center text-xs text-muted-foreground">
                  Quiet right now — be the first to make your picks.
                </p>
              ) : null}
            </div>
          )}
        </DashboardPlainCard>
      </div>
    </main>
  )
}
