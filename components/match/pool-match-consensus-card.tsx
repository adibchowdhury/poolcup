'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import { formatConsensusUpdatedAt } from '@/src/lib/pool-match-consensus'
import {
  parsePoolMatchConsensusPayload,
  type PoolMatchConsensusPayload,
} from '@/src/lib/pool-match-consensus'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'

type CardState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: PoolMatchConsensusPayload }

type PoolMatchConsensusCardProps = {
  poolId: string
  matchId: string
  team1Name: string
  team2Name: string
  poolName?: string | null
  inviteCode?: string | null
  className?: string
  source?: string
}

function roundPct(pct: number): number {
  return Math.round(Math.max(0, Math.min(100, pct)))
}

/**
 * Post-lock per-pool consensus with counts (everyone in the pool).
 * Restores original "PoolCup consensus" + scorelines-with-counts layout.
 */
export function PoolMatchConsensusCard({
  poolId,
  matchId,
  team1Name,
  team2Name,
  poolName,
  inviteCode,
  className,
  source = 'match_hub_post_lock',
}: PoolMatchConsensusCardProps) {
  const [state, setState] = useState<CardState>({ status: 'loading' })
  const [nowMs, setNowMs] = useState(() => Date.now())
  const viewedOnce = useRef(false)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setState((prev) =>
          prev.status === 'ready' ? prev : { status: 'loading' },
        )
      }

      try {
        const res = await fetch(
          `/api/pools/${poolId}/matches/${matchId}/consensus`,
          { credentials: 'same-origin', cache: 'no-store' },
        )

        if (res.status === 401) {
          setState({ status: 'unauthenticated' })
          return
        }

        const json = (await res.json()) as Record<string, unknown>

        if (res.status === 403) {
          setState({ status: 'forbidden' })
          return
        }

        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string'
              ? json.error
              : 'Failed to load pool consensus',
          )
        }

        const data = parsePoolMatchConsensusPayload(json)
        if (!data) throw new Error('invalid_consensus_payload')

        setState({ status: 'ready', data })
        if (!viewedOnce.current) {
          viewedOnce.current = true
          capturePostHog('pool_consensus_viewed', {
            match_id: matchId,
            pool_id: poolId,
            source,
            has_data: data.hasData,
            total_predictions: data.totalPredictions,
          })
        }
      } catch (err) {
        setState({
          status: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to load pool consensus',
        })
      }
    },
    [poolId, matchId, source],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (state.status !== 'ready' || !state.data.updatedAt) return
    const id = window.setInterval(() => setNowMs(Date.now()), 5_000)
    return () => window.clearInterval(id)
  }, [state])

  const titleSuffix = poolName?.trim() ? ` · ${poolName.trim()}` : ''

  return (
    <section
      className={cn(
        'rounded-xl border border-border/90 bg-card/50 p-4 sm:p-5',
        className,
      )}
      aria-live="polite"
    >
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
            PoolCup consensus{titleSuffix}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How your pool predicted this match
          </p>
        </div>
        {state.status === 'ready' && state.data.updatedAt ? (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {formatConsensusUpdatedAt(state.data.updatedAt, nowMs)}
          </p>
        ) : null}
      </header>

      {state.status === 'loading' ? <PoolConsensusSkeleton /> : null}

      {state.status === 'unauthenticated' ? (
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/login?next=${encodeURIComponent(`/match/${matchId}`)}`}
            className={cn(
              'font-semibold text-primary underline-offset-2 hover:underline',
              FOCUS_VISIBLE_RING,
              'rounded-sm',
            )}
          >
            Sign in
          </Link>{' '}
          to see pool consensus.
        </p>
      ) : null}

      {state.status === 'forbidden' ? (
        <p className="text-sm text-muted-foreground">
          Join this pool to see its consensus
          {inviteCode ? (
            <>
              .{' '}
              <Link
                href={`/pool/${inviteCode}`}
                className={cn(
                  'font-semibold text-primary underline-offset-2 hover:underline',
                  FOCUS_VISIBLE_RING,
                  'rounded-sm',
                )}
              >
                Open pool
              </Link>
            </>
          ) : (
            '.'
          )}
        </p>
      ) : null}

      {state.status === 'error' ? (
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">{state.message}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={FOCUS_VISIBLE_RING}
            onClick={() => void load()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Retry
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' && !state.data.hasData ? (
        <p className="text-sm text-muted-foreground">
          Not enough predictions yet
        </p>
      ) : null}

      {state.status === 'ready' && state.data.hasData ? (
        <PoolConsensusBody
          team1Name={team1Name}
          team2Name={team2Name}
          data={state.data}
        />
      ) : null}
    </section>
  )
}

function PoolConsensusSkeleton() {
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label="Loading pool consensus"
    >
      <ShimmerBlock className="h-3 w-40 rounded" />
      <ShimmerBlock className="h-8 w-full rounded-lg" />
      <ShimmerBlock className="h-8 w-full rounded-lg" />
      <ShimmerBlock className="h-8 w-full rounded-lg" />
      <ShimmerBlock className="h-24 w-full rounded-lg" />
    </div>
  )
}

function PoolConsensusBody({
  team1Name,
  team2Name,
  data,
}: {
  team1Name: string
  team2Name: string
  data: Extract<PoolMatchConsensusPayload, { hasData: true }>
}) {
  const rows = [
    {
      key: 'home',
      label: team1Name,
      pct: roundPct(data.outcome.team1WinPct),
      bar: 'bg-primary',
    },
    {
      key: 'draw',
      label: 'Draw',
      pct: roundPct(data.outcome.drawPct),
      bar: 'bg-muted-foreground/70',
    },
    {
      key: 'away',
      label: team2Name,
      pct: roundPct(data.outcome.team2WinPct),
      bar: 'bg-sky-400',
    },
  ] as const

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-foreground">
                {row.label}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {row.pct}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted/60"
              role="img"
              aria-label={`${row.label} ${row.pct}%`}
            >
              <div
                className={cn('h-full rounded-full transition-all', row.bar)}
                style={{ width: `${row.pct}%` }}
              />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {data.totalPredictions.toLocaleString()} prediction
          {data.totalPredictions === 1 ? '' : 's'} in this pool
        </p>
      </div>

      {data.topScores.length > 0 ? (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Most predicted scorelines
          </h4>
          <ul className="space-y-2">
            {data.topScores.map((row) => (
              <li
                key={row.score}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5"
              >
                <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                  {row.score}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {roundPct(row.pct)}%
                  <span className="ml-2 text-[11px]">
                    ({row.count.toLocaleString()})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
