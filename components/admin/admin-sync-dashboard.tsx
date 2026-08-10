'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  isStaleFixtureSync,
  SYNC_JOB_RETRY_TARGETS,
  type SyncStatusRow,
} from '@/src/lib/admin-sync-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

function formatWhen(value: string | null | undefined): string {
  if (!value) return '—'
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return value
  return new Date(ms).toLocaleString()
}

function statusTone(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase()
  if (s === 'success') return 'text-primary'
  if (s === 'error') return 'text-destructive'
  if (s === 'partial') return 'text-amber-400'
  return 'text-muted-foreground'
}

export function AdminSyncDashboard({
  initialRows,
  initialError,
}: {
  initialRows: SyncStatusRow[]
  initialError: string | null
}) {
  const [rows, setRows] = useState(initialRows)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [retryingKey, setRetryingKey] = useState<string | null>(null)
  const [retryMessage, setRetryMessage] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/sync/status', { cache: 'no-store' })
      const json = (await res.json()) as {
        rows?: SyncStatusRow[]
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? 'Failed to load sync status')
        setRows([])
      } else {
        setRows(json.rows ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setRows(initialRows)
    setError(initialError)
  }, [initialRows, initialError])

  const grouped = useMemo(() => {
    const map = new Map<string, SyncStatusRow[]>()
    for (const row of rows) {
      const key = row.job_type || 'unknown'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return map
  }, [rows])

  async function retryJob(jobType: string, eventId: string | null) {
    const key = `${jobType}:${eventId ?? 'all'}`
    setRetryingKey(key)
    setRetryMessage(null)
    try {
      const res = await fetch('/api/admin/sync/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType, eventId }),
      })
      const json = (await res.json()) as {
        success?: boolean
        error?: string
        body?: { error?: string }
      }
      if (!res.ok || !json.success) {
        setRetryMessage(
          json.error ??
            json.body?.error ??
            `Retry failed (${res.status})`,
        )
      } else {
        setRetryMessage(`Triggered ${jobType} successfully.`)
        await reload()
      }
    } catch (err) {
      setRetryMessage(err instanceof Error ? err.message : 'Retry failed')
    } finally {
      setRetryingKey(null)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl bg-background px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground',
              FOCUS_VISIBLE_RING,
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          <h1 className="mt-3 font-display text-2xl tracking-wide text-foreground sm:text-3xl">
            Sync status
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Soccer ingestion jobs (API-Football). Admins only.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className={cn('gap-2', FOCUS_VISIBLE_RING)}
          disabled={loading}
          onClick={() => void reload()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          Refresh
        </Button>
      </div>

      {retryMessage ? (
        <p className="mb-4 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-foreground">
          {retryMessage}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            className={cn('mt-3', FOCUS_VISIBLE_RING)}
            onClick={() => void reload()}
          >
            Try again
          </Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading sync status…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No sync jobs recorded yet. Crons will appear here after the next run.
        </p>
      ) : (
        <div className="space-y-6">
          {SYNC_JOB_RETRY_TARGETS.map((target) => {
            const jobRows = grouped.get(target.jobType) ?? []
            return (
              <section
                key={target.jobType}
                className="rounded-2xl border border-border bg-card/40 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg tracking-wide text-foreground">
                    {target.label}
                  </h2>
                  {!target.supportsEventId || jobRows.length === 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn('gap-1.5', FOCUS_VISIBLE_RING)}
                      disabled={retryingKey === `${target.jobType}:all`}
                      onClick={() => void retryJob(target.jobType, null)}
                    >
                      {retryingKey === `${target.jobType}:all` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Retry
                    </Button>
                  ) : null}
                </div>

                {jobRows.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No runs logged for this job yet.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-border/60">
                    {jobRows.map((row) => {
                      const stale = isStaleFixtureSync(row)
                      const failed =
                        (row.last_status ?? '').toLowerCase() === 'error'
                      const key = `${row.job_type}:${row.event_id ?? 'all'}`
                      return (
                        <li
                          key={`${row.job_type}-${row.event_id ?? 'global'}-${row.last_finished_at}`}
                          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {row.event_name ??
                                (row.event_id ? row.event_id : 'All events')}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Last run {formatWhen(row.last_finished_at)} ·{' '}
                              <span className={statusTone(row.last_status)}>
                                {row.last_status ?? 'unknown'}
                              </span>
                              {row.last_success_at
                                ? ` · last success ${formatWhen(row.last_success_at)}`
                                : ''}
                            </p>
                            {row.last_error_message ? (
                              <p className="mt-1 text-xs text-destructive/90">
                                {row.last_error_message}
                              </p>
                            ) : null}
                            {(stale || failed) && (
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                                <AlertTriangle className="h-3 w-3" aria-hidden />
                                {failed ? 'Last run failed' : 'Stale (>24h)'}
                              </p>
                            )}
                          </div>
                          {target.supportsEventId ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={cn(
                                'shrink-0 gap-1.5',
                                FOCUS_VISIBLE_RING,
                              )}
                              disabled={retryingKey === key}
                              onClick={() =>
                                void retryJob(target.jobType, row.event_id)
                              }
                            >
                              {retryingKey === key ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Retry
                            </Button>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
