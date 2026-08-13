'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

export type ScoringVersionRow = {
  id: string | null
  version: number | null
  style: string
  exact: number | null
  winner: number | null
  draw: number | null
  actorId: string | null
  actorName: string | null
  createdAt: string | null
}

type Props = {
  poolId: string
  /** Bump to refetch after a successful save. */
  refreshKey?: number
}

function formatWhen(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function PoolScoringHistory({ poolId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<ScoringVersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const viewedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/pools/${encodeURIComponent(poolId)}/scoring-versions?limit=40`,
      )
      const data = (await res.json()) as {
        rows?: ScoringVersionRow[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Could not load scoring history')
      setRows(Array.isArray(data.rows) ? data.rows : [])
      if (!viewedRef.current) {
        viewedRef.current = true
        capturePostHog('scoring_history_viewed', { pool_id: poolId })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-foreground">Scoring history</h4>
        <p className="text-xs text-muted-foreground">
          Past scoring changes for this pool (visible to all members).
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2
            className="h-5 w-5 animate-spin text-primary"
            aria-label="Loading scoring history"
          />
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
          No scoring changes yet.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border">
          {rows.map((row, index) => {
            const key = row.id ?? `${row.version ?? 'v'}-${row.createdAt ?? index}`
            return (
              <li
                key={key}
                className="flex flex-col gap-1 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {row.version != null ? `Version ${row.version}` : 'Update'}
                    <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                      exact {row.exact ?? '—'} · winner {row.winner ?? '—'} ·
                      draw {row.draw ?? '—'}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.actorName || 'Commissioner'}
                    {row.createdAt ? ` · ${formatWhen(row.createdAt)}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
