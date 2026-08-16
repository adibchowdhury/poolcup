'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, ChevronRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LockedProFeature } from '@/components/pro/locked-pro-feature'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

type Gate = 'loading' | 'pro' | 'locked'

/**
 * Profile entry to the unified /analytics page (Performance + History).
 * Free users see a Pro lock teaser; Pro users get a direct CTA.
 */
export function ProfileAnalyticsEntry({ className }: { className?: string }) {
  const [gate, setGate] = useState<Gate>('loading')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/analytics', {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        if (cancelled) return
        if (res.status === 403) {
          setGate('locked')
          return
        }
        setGate('pro')
      } catch {
        if (!cancelled) setGate('pro')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className={cn('space-y-2.5', className)}>
      <div>
        <h2 className="font-display text-xl tracking-wide text-foreground">
          Your Analytics
        </h2>
        <p className="text-[10px] text-muted-foreground">
          Performance trends, AI insights, and season history
        </p>
      </div>

      {gate === 'loading' ? (
        <ShimmerBlock className="h-24 w-full rounded-2xl" />
      ) : gate === 'locked' ? (
        <LockedProFeature
          variant="banner"
          title="Performance & History"
          description="Accuracy trends, AI insights, and historical seasons — unlock with Pro."
          source="profile_analytics_entry"
          ctaText="Upgrade to Pro"
          icon={<Lock className="h-4 w-4 text-primary" aria-hidden />}
          className="items-start sm:items-center"
        />
      ) : (
        <Link
          href="/analytics"
          className={cn(
            'hue-card-surface group flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-card/95 via-[#0c1410] to-primary/[0.06] px-4 py-3.5 shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition-colors hover:border-primary/40',
            FOCUS_VISIBLE_RING,
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background/50">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg tracking-wide text-foreground transition-colors group-hover:text-primary">
              Performance & History
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Form, breakdowns, AI tips, and seasons
            </p>
          </div>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
            aria-hidden
          />
        </Link>
      )}

      {gate === 'locked' ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-full text-[11px] text-muted-foreground',
            FOCUS_VISIBLE_RING,
          )}
        >
          <Link href="/analytics">Preview Analytics page</Link>
        </Button>
      ) : null}
    </section>
  )
}
