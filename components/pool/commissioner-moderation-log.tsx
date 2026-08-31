'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

type LogRow = Record<string, unknown>

type Props = {
  poolId: string
  /** Skip fetch; show empty default UI (locked Basic preview). */
  previewOnly?: boolean
  /** Omit the section heading (parent LockedFeatureSection owns it). */
  hideHeading?: boolean
}

function pickString(row: LogRow, ...keys: string[]) {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function formatWhen(row: LogRow) {
  const raw = pickString(row, 'created_at', 'createdAt', 'at')
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString()
}

function formatAction(row: LogRow) {
  return (
    pickString(row, 'action', 'action_type', 'event')?.replaceAll('_', ' ') ||
    'action'
  )
}

function formatActor(row: LogRow) {
  return (
    pickString(
      row,
      'actor_name',
      'actor_display_name',
      'actor_username',
      'actor',
    ) || 'Someone'
  )
}

function formatTarget(row: LogRow) {
  return pickString(
    row,
    'target_name',
    'target_display_name',
    'target_username',
    'target',
  )
}

export function CommissionerModerationLog({
  poolId,
  previewOnly = false,
  hideHeading = false,
}: Props) {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(!previewOnly)
  const [error, setError] = useState<string | null>(null)
  const viewedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/pools/${encodeURIComponent(poolId)}/moderation-log?limit=40`,
      )
      const data = (await res.json()) as { rows?: LogRow[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not load history')
      setRows(Array.isArray(data.rows) ? data.rows : [])
      if (!viewedRef.current) {
        viewedRef.current = true
        capturePostHog('moderation_log_viewed', { pool_id: poolId })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => {
    if (previewOnly) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }
    void load()
  }, [load, previewOnly])

  return (
    <section className="space-y-3">
      {hideHeading ? null : (
        <h3 className="font-display text-lg tracking-wide">Moderation history</h3>
      )}
      <p className="text-xs text-muted-foreground">
        Removals, transfers, co-commissioner changes, edits, and open/close.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border px-4 py-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn('mt-2', FOCUS_VISIBLE_RING)}
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          No moderation actions yet.
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {rows.map((row, idx) => {
            const target = formatTarget(row)
            const key =
              pickString(row, 'id') || `${formatWhen(row)}-${idx}`
            return (
              <li
                key={key}
                className="rounded-xl border border-border/80 bg-card/60 px-3 py-2.5 text-sm"
              >
                <p className="font-medium capitalize text-foreground">
                  {formatAction(row)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatActor(row)}
                  {target ? ` → ${target}` : ''}
                  {formatWhen(row) ? ` · ${formatWhen(row)}` : ''}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
