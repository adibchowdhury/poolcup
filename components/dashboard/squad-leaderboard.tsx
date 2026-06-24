'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Trophy, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DashboardInsightCard,
  DASHBOARD_INSIGHT_CARD_SURFACE_CLASS,
} from '@/components/dashboard/dashboard-insight-card'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { cn } from '@/lib/utils'
import {
  buildSquadLeaderboardDisplay,
  fetchSquadLeaderboard,
  SQUAD_LEADERBOARD_PREVIEW_COUNT,
  type SquadLeaderboardRow,
} from '@/src/lib/squad-leaderboard'
import { supabase } from '@/src/lib/supabase'

type SquadLeaderboardProps = {
  pools: DashboardPoolCardData[]
}

function SquadLeaderboardSectionTitle() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Trophy className="h-5 w-5 shrink-0 text-[#ffb300]" aria-hidden />
      <h2 className="font-display text-2xl tracking-wide text-foreground">
        World Cup 2026 Squad Leaderboard
      </h2>
    </div>
  )
}

function SquadLeaderboardSection({
  children,
}: {
  children: ReactNode
}) {
  return (
    <section className="space-y-6">
      <SquadLeaderboardSectionTitle />
      {children}
    </section>
  )
}

function SquadLeaderboardSkeleton() {
  return (
    <SquadLeaderboardSection>
      <div
        className={cn('animate-pulse', DASHBOARD_INSIGHT_CARD_SURFACE_CLASS)}
        aria-hidden
      >
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
            >
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="h-10 w-10 rounded-2xl bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
              <div className="h-8 w-14 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </SquadLeaderboardSection>
  )
}

function formatAvgPoints(value: number): string {
  return Number(value).toFixed(1)
}

function formatPlayerCount(count: number): string {
  return count === 1 ? '1 player' : `${count} players`
}

function getYourSquadLabel(row: SquadLeaderboardRow, pinnedBelowTop: boolean): string {
  return pinnedBelowTop ? `Your squad — #${row.rank}` : 'Your squad'
}

function SquadLeaderboardRowItem({
  row,
  pinnedBelowTop = false,
}: {
  row: SquadLeaderboardRow
  pinnedBelowTop?: boolean
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 sm:gap-3 sm:px-3',
        row.is_mine
          ? 'border-primary/45 bg-primary/10'
          : 'border-border/70 bg-card/40',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums',
          row.rank <= 3
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-border bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {row.rank}
      </span>

      <PoolAvatarImage avatar={row.avatar} size="sm" className="rounded-xl" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-sm font-semibold text-foreground sm:text-base">
            {row.name}
          </p>
          {row.is_mine ? (
            <span className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {getYourSquadLabel(row, pinnedBelowTop)}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatPlayerCount(row.member_count)}
          <span className="mx-1.5 text-border" aria-hidden>
            ·
          </span>
          {row.total_points.toLocaleString()} total pts
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-display text-xl leading-none tracking-wide text-foreground tabular-nums sm:text-2xl">
          {formatAvgPoints(row.avg_points)}
        </p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          avg pts
        </p>
      </div>
    </li>
  )
}

export function SquadLeaderboard({ pools }: SquadLeaderboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<SquadLeaderboardRow[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const result = await fetchSquadLeaderboard(supabase)

      if (cancelled) return

      if (result === null) {
        setError('Could not load the squad leaderboard.')
        setRows(null)
      } else {
        setRows(result)
      }

      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const display = useMemo(
    () =>
      rows
        ? buildSquadLeaderboardDisplay(rows, expanded)
        : { rows: [], pinnedMineRows: [] },
    [rows, expanded],
  )

  const hasPoolOnBoard = useMemo(
    () => Boolean(rows?.some((row) => row.is_mine)),
    [rows],
  )

  const showEncourageInvite = Boolean(
    pools.length > 0 && !loading && !error && rows && !hasPoolOnBoard,
  )

  const canExpand = Boolean(rows && rows.length > SQUAD_LEADERBOARD_PREVIEW_COUNT)

  if (loading) {
    return <SquadLeaderboardSkeleton />
  }

  if (error) {
    return (
      <SquadLeaderboardSection>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </SquadLeaderboardSection>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <SquadLeaderboardSection>
        <DashboardInsightCard>
          <p className="text-sm text-muted-foreground">
            No squads have qualified yet. Squads need 3+ members and match points to
            appear here.
          </p>
          {showEncourageInvite ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Invite more friends to your pool to get on the board once scoring
              starts.
            </p>
          ) : null}
        </DashboardInsightCard>
      </SquadLeaderboardSection>
    )
  }

  return (
    <SquadLeaderboardSection>
      <DashboardInsightCard>
        {showEncourageInvite ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p>
              None of your pools are on the board yet. Squads need at least 3
              members and points from scored matches — invite more people to climb
              the rankings.
            </p>
          </div>
        ) : null}

        <ul
          className={cn(
            'space-y-2',
            expanded && 'max-h-[min(32rem,70vh)] overflow-y-auto pr-1',
          )}
        >
          {display.rows.map((row) => (
            <SquadLeaderboardRowItem key={row.pool_id} row={row} />
          ))}

          {!expanded && display.pinnedMineRows.length > 0 ? (
            <>
              <li className="list-none py-1" aria-hidden>
                <div className="h-px bg-border/80" />
              </li>
              {display.pinnedMineRows.map((row) => (
                <SquadLeaderboardRowItem
                  key={row.pool_id}
                  row={row}
                  pinnedBelowTop
                />
              ))}
            </>
          ) : null}
        </ul>

        {canExpand ? (
          <div className="flex flex-col items-center gap-2 pt-1 sm:flex-row sm:justify-between">
            {!expanded ? (
              <p className="text-center text-xs text-muted-foreground sm:text-left">
                Showing top {SQUAD_LEADERBOARD_PREVIEW_COUNT}
                {display.pinnedMineRows.length > 1
                  ? ' plus your squads'
                  : display.pinnedMineRows.length === 1
                    ? ' plus your squad'
                    : ''}
                . {rows.length.toLocaleString()} squads ranked in total.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {rows.length.toLocaleString()} squads ranked by average points.
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-border text-foreground hover:bg-muted"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded
                ? `Show top ${SQUAD_LEADERBOARD_PREVIEW_COUNT}`
                : 'Show full leaderboard'}
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  expanded && 'rotate-180',
                )}
                aria-hidden
              />
            </Button>
          </div>
        ) : null}
      </DashboardInsightCard>
    </SquadLeaderboardSection>
  )
}
