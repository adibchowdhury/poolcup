'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AdminErrorState,
  formatUsd,
} from '@/components/admin/admin-shell'
import type { AdminMetrics } from '@/src/lib/admin-console-shared'
import { ADMIN_NAV } from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

function MetricCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl tracking-wide text-foreground">
        {value}
      </p>
    </div>
  )
}

export function AdminMetricsDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/metrics', { cache: 'no-store' })
      const json = (await res.json()) as {
        metrics?: AdminMetrics
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? `Failed to load metrics (${res.status})`)
        setMetrics(null)
      } else {
        setMetrics(json.metrics ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sections = ADMIN_NAV.filter((item) => item.href !== '/admin')

  return (
    <div className="space-y-8">
      <section aria-labelledby="admin-metrics-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="admin-metrics-heading"
              className="text-lg font-semibold text-foreground"
            >
              Metrics
            </h2>
            <p className="text-sm text-muted-foreground">
              Live snapshot from admin_get_metrics.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('gap-2', FOCUS_VISIBLE_RING)}
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Refresh
          </Button>
        </div>

        {loading && !metrics ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-7 w-7 animate-spin text-primary"
              aria-label="Loading metrics"
            />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={() => void load()} />
        ) : !metrics ? (
          <p className="text-sm text-muted-foreground">No metrics available.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Total users" value={metrics.total_users} />
            <MetricCard label="DAU (24h)" value={metrics.dau} />
            <MetricCard
              label="Predictions today"
              value={metrics.predictions_today}
            />
            <MetricCard
              label="Pools created today"
              value={metrics.pools_created_today}
            />
            <MetricCard label="Subs · Free" value={metrics.subs_free} />
            <MetricCard label="Subs · Pro" value={metrics.subs_pro} />
            <MetricCard
              label="Subs · Commissioner"
              value={metrics.subs_commissioner}
            />
            <MetricCard
              label="MRR estimate"
              value={formatUsd(metrics.mrr_estimate)}
            />
            <MetricCard label="Total pools" value={metrics.total_pools} />
            <MetricCard
              label="Total predictions"
              value={metrics.total_predictions}
            />
            <MetricCard label="Banned users" value={metrics.banned_users} />
          </div>
        )}
      </section>

      <section aria-labelledby="admin-sections-heading">
        <h2
          id="admin-sections-heading"
          className="mb-3 text-lg font-semibold text-foreground"
        >
          Admin sections
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'block rounded-xl border border-border bg-card/40 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/40',
                  FOCUS_VISIBLE_RING,
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
