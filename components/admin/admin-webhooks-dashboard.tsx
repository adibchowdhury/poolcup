'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import {
  AdminErrorState,
  formatAdminWhen,
} from '@/components/admin/admin-shell'
import { Button } from '@/components/ui/button'
import type { AdminFailedWebhookRow } from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

export function AdminWebhooksDashboard() {
  const [events, setEvents] = useState<AdminFailedWebhookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/webhooks/failed?limit=50', {
        cache: 'no-store',
      })
      const json = (await res.json()) as {
        events?: AdminFailedWebhookRow[]
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? `Failed to load (${res.status})`)
        setEvents([])
      } else {
        setEvents(json.events ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      {error ? (
        <AdminErrorState message={error} onRetry={() => void load()} />
      ) : loading && events.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2
            className="h-7 w-7 animate-spin text-primary"
            aria-label="Loading failed webhooks"
          />
        </div>
      ) : events.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No results
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Event id</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Error</th>
                <th className="px-3 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.stripe_event_id}
                  className="border-b border-border/60 last:border-0 align-top"
                >
                  <td className="px-3 py-2.5 font-mono text-xs break-all">
                    {event.stripe_event_id}
                  </td>
                  <td className="px-3 py-2.5">{event.event_type ?? '—'}</td>
                  <td className="px-3 py-2.5 max-w-md break-words text-destructive">
                    {event.error ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatAdminWhen(event.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
