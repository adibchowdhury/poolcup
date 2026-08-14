'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import {
  AdminErrorState,
  formatAdminWhen,
} from '@/components/admin/admin-shell'
import { Button } from '@/components/ui/button'
import type { AdminAuditLogRow } from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

function formatDetail(detail: unknown): string {
  if (detail == null) return '—'
  if (typeof detail === 'string') return detail
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

export function AdminAuditDashboard() {
  const [entries, setEntries] = useState<AdminAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/audit?limit=100', {
        cache: 'no-store',
      })
      const json = (await res.json()) as {
        entries?: AdminAuditLogRow[]
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? `Failed to load (${res.status})`)
        setEntries([])
      } else {
        setEntries(json.entries ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setEntries([])
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
      ) : loading && entries.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2
            className="h-7 w-7 animate-spin text-primary"
            aria-label="Loading audit log"
          />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No results
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Admin</th>
                <th className="px-3 py-3 font-medium">Action</th>
                <th className="px-3 py-3 font-medium">Target</th>
                <th className="px-3 py-3 font-medium">Detail</th>
                <th className="px-3 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border/60 last:border-0 align-top"
                >
                  <td className="px-3 py-2.5">
                    {entry.admin_name ?? entry.admin_id ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">{entry.action}</td>
                  <td className="px-3 py-2.5">
                    <div>{entry.target_type ?? '—'}</div>
                    <div className="font-mono text-xs text-muted-foreground break-all">
                      {entry.target_id ?? ''}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 max-w-md break-words font-mono text-xs">
                    {formatDetail(entry.detail)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatAdminWhen(entry.created_at)}
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
