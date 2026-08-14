'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Lock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProUpgradeModal } from '@/components/pro/pro-upgrade-modal'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import {
  formatConsensusUpdatedAt,
  type MatchConsensusPayload,
  parseMatchConsensusPayload,
} from '@/src/lib/match-consensus'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'

const POLL_MS = 30_000

type CardState =
  | { status: 'loading' }
  | { status: 'locked' }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      data: MatchConsensusPayload
      isPro: boolean
      matchLocked: boolean
    }

type MatchConsensusCardProps = {
  matchId: string
  team1Name: string
  team2Name: string
  /** full = match hub; compact = predict row (always Pro-only UI) */
  variant?: 'full' | 'compact'
  className?: string
  /** PostHog source tag */
  source?: string
}

function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, pct))
}

function roundPct(pct: number): number {
  return Math.round(clampPct(pct))
}

export function MatchConsensusCard({
  matchId,
  team1Name,
  team2Name,
  variant = 'full',
  className,
  source = 'match_hub',
}: MatchConsensusCardProps) {
  const [state, setState] = useState<CardState>({ status: 'loading' })
  const [nowMs, setNowMs] = useState(() => Date.now())
  const viewedOnce = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(variant === 'full')

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setState((prev) =>
          prev.status === 'ready' || prev.status === 'locked'
            ? prev
            : { status: 'loading' },
        )
      }

      try {
        const res = await fetch(`/api/matches/${matchId}/consensus`, {
          credentials: 'same-origin',
          cache: 'no-store',
        })

        if (res.status === 401) {
          setState({ status: 'unauthenticated' })
          if (!viewedOnce.current) {
            viewedOnce.current = true
            capturePostHog('match_consensus_viewed', {
              match_id: matchId,
              is_pro: false,
              source,
              feature_locked: true,
              unauthenticated: true,
            })
          }
          return
        }

        const json = (await res.json()) as Record<string, unknown>
        const isPro = json.isPro === true
        const matchLocked = json.match_locked === true

        // Pre-lock Pro gate (API 403) OR compact strip stays Pro-only.
        const featureLocked =
          res.status === 403 ||
          json.feature_locked === true ||
          json.error === 'pro_required' ||
          (variant === 'compact' && res.ok && !isPro)

        if (featureLocked) {
          setState({ status: 'locked' })
          if (!viewedOnce.current) {
            viewedOnce.current = true
            capturePostHog('match_consensus_viewed', {
              match_id: matchId,
              is_pro: false,
              source,
              feature_locked: true,
              match_locked: matchLocked,
              variant,
            })
          }
          return
        }

        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string'
              ? json.error
              : 'Failed to load consensus',
          )
        }

        const data =
          parseMatchConsensusPayload(json) ??
          (json.hasData === false || json.has_data === false
            ? { hasData: false as const, updatedAt: null }
            : null)

        if (!data) {
          throw new Error('invalid_consensus_payload')
        }

        setState({ status: 'ready', data, isPro, matchLocked })
        if (!viewedOnce.current) {
          viewedOnce.current = true
          capturePostHog('match_consensus_viewed', {
            match_id: matchId,
            is_pro: isPro,
            source,
            has_data: data.hasData,
            match_locked: matchLocked,
            variant,
          })
        }
      } catch (err) {
        setState({
          status: 'error',
          message:
            err instanceof Error ? err.message : 'Failed to load consensus',
        })
      }
    },
    [matchId, source, variant],
  )

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        setVisible(entries.some((e) => e.isIntersecting))
      },
      { rootMargin: '80px', threshold: 0.05 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    void load()
    const id = window.setInterval(() => {
      void load({ silent: true })
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [visible, load])

  useEffect(() => {
    if (state.status !== 'ready' || !state.data.updatedAt) return
    const id = window.setInterval(() => setNowMs(Date.now()), 5_000)
    return () => window.clearInterval(id)
  }, [state])

  const shellClass =
    variant === 'full'
      ? 'rounded-xl border border-border/90 bg-card/50 p-4 sm:p-5'
      : 'rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2'

  const showProChrome =
    variant === 'full' &&
    (state.status === 'locked' ||
      state.status === 'unauthenticated' ||
      (state.status === 'ready' && !state.matchLocked) ||
      state.status === 'loading')

  const heading =
    state.status === 'ready' && state.matchLocked
      ? 'PoolCup consensus'
      : 'Crowd Win Chance'

  return (
    <div
      ref={rootRef}
      className={cn(shellClass, className)}
      aria-live="polite"
    >
      {variant === 'full' ? (
        <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            {showProChrome ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                Pro insight
              </p>
            ) : null}
            <h3 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
              {heading}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {state.status === 'ready' && state.matchLocked
                ? 'How PoolCup predicted this match'
                : 'How PoolCup is predicting this match'}
            </p>
          </div>
          {state.status === 'ready' && state.data.updatedAt ? (
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {formatConsensusUpdatedAt(state.data.updatedAt, nowMs)}
            </p>
          ) : null}
        </header>
      ) : (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            Crowd Win Chance
          </p>
          {state.status === 'ready' && state.data.hasData ? (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {formatConsensusUpdatedAt(state.data.updatedAt, nowMs)}
            </span>
          ) : null}
        </div>
      )}

      {state.status === 'loading' ? (
        <ConsensusSkeleton variant={variant} />
      ) : null}

      {state.status === 'locked' || state.status === 'unauthenticated' ? (
        <LockedConsensusTeaser
          variant={variant}
          matchId={matchId}
          source={source}
          unauthenticated={state.status === 'unauthenticated'}
        />
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
        <ConsensusBody
          variant={variant}
          team1Name={team1Name}
          team2Name={team2Name}
          data={state.data}
        />
      ) : null}
    </div>
  )
}

function ConsensusSkeleton({ variant }: { variant: 'full' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div aria-busy="true" aria-label="Loading crowd consensus">
        <ShimmerBlock className="h-2 w-full rounded-full" />
        <div className="mt-1.5 flex justify-between gap-2">
          <ShimmerBlock className="h-3 w-12 rounded" />
          <ShimmerBlock className="h-3 w-10 rounded" />
          <ShimmerBlock className="h-3 w-12 rounded" />
        </div>
      </div>
    )
  }
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label="Loading crowd consensus"
    >
      <ShimmerBlock className="h-3 w-full rounded-full" />
      <ShimmerBlock className="h-8 w-full rounded-lg" />
      <ShimmerBlock className="h-8 w-full rounded-lg" />
      <ShimmerBlock className="h-8 w-3/4 rounded-lg" />
    </div>
  )
}

function LockedConsensusTeaser({
  variant,
  matchId,
  source,
  unauthenticated,
}: {
  variant: 'full' | 'compact'
  matchId: string
  source: string
  unauthenticated: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const loginHref = `/login?next=${encodeURIComponent(`/match/${matchId}`)}`

  const onUpgradeClick = () => {
    capturePostHog('match_consensus_upgrade_prompt_clicked', {
      match_id: matchId,
      source,
    })
    setModalOpen(true)
  }

  if (variant === 'compact') {
    return (
      <>
        <div
          className="flex flex-wrap items-center justify-between gap-2"
          role="group"
          aria-label="Crowd Win Chance is a Pro feature, locked"
        >
          <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              Pro: see how the crowd is predicting this match
            </span>
          </p>
          {unauthenticated ? (
            <Link
              href={loginHref}
              className={cn(
                'shrink-0 text-[11px] font-semibold text-primary underline-offset-2 hover:underline',
                FOCUS_VISIBLE_RING,
                'rounded-sm',
              )}
            >
              Sign in
            </Link>
          ) : (
            <button
              type="button"
              onClick={onUpgradeClick}
              className={cn(
                'shrink-0 text-[11px] font-semibold text-primary underline-offset-2 hover:underline',
                FOCUS_VISIBLE_RING,
                'rounded-sm',
              )}
            >
              Upgrade
            </button>
          )}
        </div>
        {!unauthenticated ? (
          <ProUpgradeModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            source={`match_consensus_${source}`}
            headline="Unlock Crowd Win Chance"
            description="See the crowd outcome split and top scorelines before kickoff — the Pro pre-lock advantage."
          />
        ) : null}
      </>
    )
  }

  return (
    <>
      <div
        className="relative overflow-hidden rounded-lg border border-dashed border-border bg-muted/25 px-4 py-6 text-center"
        role="group"
        aria-label="Crowd Win Chance is a Pro feature, locked"
      >
        <div
          className="pointer-events-none absolute inset-x-4 top-3 h-2 rounded-full bg-gradient-to-r from-primary/40 via-muted-foreground/30 to-sky-400/40 blur-[0.5px]"
          aria-hidden
        />
        <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/70 text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm font-medium text-foreground">
          Pro: see how the crowd is predicting this match
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Unlock the crowd outcome split and top scorelines before kickoff — the
          Pro pre-lock advantage. After lock, consensus is free for everyone.
        </p>
        {unauthenticated ? (
          <Button asChild size="sm" className={cn('mt-4', FOCUS_VISIBLE_RING)}>
            <Link href={loginHref}>Sign in</Link>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className={cn('mt-4', FOCUS_VISIBLE_RING)}
            onClick={onUpgradeClick}
          >
            Upgrade to Pro
          </Button>
        )}
      </div>
      {!unauthenticated ? (
        <ProUpgradeModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          source={`match_consensus_${source}`}
          headline="Unlock Crowd Win Chance"
          description="See the crowd outcome split and top scorelines before kickoff — the Pro pre-lock advantage."
        />
      ) : null}
    </>
  )
}

function ConsensusBody({
  variant,
  team1Name,
  team2Name,
  data,
}: {
  variant: 'full' | 'compact'
  team1Name: string
  team2Name: string
  data: Extract<MatchConsensusPayload, { hasData: true }>
}) {
  const t1 = roundPct(data.outcome.team1WinPct)
  const draw = roundPct(data.outcome.drawPct)
  const t2 = roundPct(data.outcome.team2WinPct)

  return (
    <div className="space-y-3">
      <OutcomeSplitBar
        team1Name={team1Name}
        team2Name={team2Name}
        team1Pct={t1}
        drawPct={draw}
        team2Pct={t2}
        compact={variant === 'compact'}
      />

      {variant === 'full' && data.topScores.length > 0 ? (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top scorelines
          </h4>
          <ol className="space-y-1.5">
            {data.topScores.map((row, index) => (
              <li
                key={`${row.score}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
              >
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {row.score}
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {roundPct(row.pct)}%
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}

function OutcomeSplitBar({
  team1Name,
  team2Name,
  team1Pct,
  drawPct,
  team2Pct,
  compact,
}: {
  team1Name: string
  team2Name: string
  team1Pct: number
  drawPct: number
  team2Pct: number
  compact: boolean
}) {
  const label = `${team1Name} ${team1Pct}%, Draw ${drawPct}%, ${team2Name} ${team2Pct}%`

  return (
    <div>
      <div
        className={cn(
          'flex w-full overflow-hidden rounded-full bg-muted/50',
          compact ? 'h-2' : 'h-3',
        )}
        role="img"
        aria-label={label}
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${team1Pct}%` }}
          title={`${team1Name} ${team1Pct}%`}
        />
        <div
          className="h-full bg-muted-foreground/55 transition-[width]"
          style={{ width: `${drawPct}%` }}
          title={`Draw ${drawPct}%`}
        />
        <div
          className="h-full bg-sky-400 transition-[width]"
          style={{ width: `${team2Pct}%` }}
          title={`${team2Name} ${team2Pct}%`}
        />
      </div>
      <div
        className={cn(
          'mt-2 grid grid-cols-3 gap-2 text-muted-foreground',
          compact ? 'text-[10px]' : 'text-xs sm:text-sm',
        )}
      >
        <p className="min-w-0 text-left">
          <span className="block truncate font-medium text-foreground">
            {team1Name}
          </span>
          <span className="font-mono tabular-nums">{team1Pct}%</span>
        </p>
        <p className="text-center">
          <span className="block font-medium text-foreground">Draw</span>
          <span className="font-mono tabular-nums">{drawPct}%</span>
        </p>
        <p className="min-w-0 text-right">
          <span className="block truncate font-medium text-foreground">
            {team2Name}
          </span>
          <span className="font-mono tabular-nums">{team2Pct}%</span>
        </p>
      </div>
    </div>
  )
}
