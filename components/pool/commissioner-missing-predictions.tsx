'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { shareOrCopy } from '@/src/lib/share-client'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { useAuth } from '@/src/lib/auth-context'
import { cn } from '@/lib/utils'

type MissingRow = Record<string, unknown>

type Props = {
  poolId: string
  inviteCode?: string
  poolName: string
}

function pickString(row: MissingRow, ...keys: string[]) {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function pickNumber(row: MissingRow, ...keys: string[]) {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) {
      return Number(v)
    }
  }
  return 0
}

export function CommissionerMissingPredictions({
  poolId,
  inviteCode,
  poolName,
}: Props) {
  const { user } = useAuth()
  const [rows, setRows] = useState<MissingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const viewedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/pools/${encodeURIComponent(poolId)}/members-missing-predictions`,
      )
      const data = (await res.json()) as { rows?: MissingRow[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not load')
      setRows(Array.isArray(data.rows) ? data.rows : [])
      if (!viewedRef.current) {
        viewedRef.current = true
        capturePostHog('members_missing_viewed', { pool_id: poolId })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => {
    void load()
  }, [load])

  async function nudge() {
    if (!inviteCode) return
    const url = buildJoinInviteUrl(
      window.location.origin,
      inviteCode,
      user?.id,
    )
    try {
      await shareOrCopy({
        title: `Predict in ${poolName} on PoolCup`,
        text: 'Upcoming matches need your picks — jump back into the pool.',
        url,
        type: 'pool_nudge',
      })
    } catch {
      /* abort */
    }
  }

  const hasUpcomingSignal = rows.some((row) => {
    const missing = pickNumber(
      row,
      'missing_count',
      'unpredicted_count',
      'upcoming_unpredicted',
      'count',
    )
    return missing > 0
  })

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg tracking-wide">
          Missing predictions
        </h3>
        {inviteCode ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn('gap-1.5', FOCUS_VISIBLE_RING)}
            onClick={() => void nudge()}
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Nudge / share invite
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Members and how many upcoming matches they still need to predict.
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
      ) : rows.length === 0 || !hasUpcomingSignal ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          No upcoming matches needing picks — or everyone is caught up.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
          {rows.map((row, idx) => {
            const name =
              pickString(
                row,
                'display_name',
                'member_name',
                'username',
                'name',
              ) || 'Member'
            const missing = pickNumber(
              row,
              'missing_count',
              'unpredicted_count',
              'upcoming_unpredicted',
              'count',
            )
            const id =
              pickString(row, 'user_id', 'member_id', 'id') || `${name}-${idx}`
            if (missing <= 0) return null
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-3 bg-card/50 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{name}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-amber-300">
                  {missing} upcoming
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
