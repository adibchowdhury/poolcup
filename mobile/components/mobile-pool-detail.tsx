'use client'

import { useEffect, useState } from 'react'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import {
  fetchPoolStandingsMobile,
  memberInitials,
  type MobilePoolStandingRow,
} from '../lib/fetch-pool-standings-mobile'
import { supabase } from '../lib/supabase-mobile'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'

function ordinalPlace(place: number): string {
  const mod100 = place % 100
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`
  switch (place % 10) {
    case 1:
      return `${place}st`
    case 2:
      return `${place}nd`
    case 3:
      return `${place}rd`
    default:
      return `${place}th`
  }
}

type MobilePoolDetailProps = {
  pool: DashboardPoolCardData
  onBack: () => void
}

export function MobilePoolDetail({ pool, onBack }: MobilePoolDetailProps) {
  const [standings, setStandings] = useState<MobilePoolStandingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (userError || !user) {
        setError(userError?.message ?? 'Could not load your account')
        setStandings([])
        setLoading(false)
        return
      }

      const { standings: rows, error: fetchError } = await fetchPoolStandingsMobile(
        supabase,
        pool,
        user.id,
      )

      if (cancelled) return

      setStandings(rows)
      setError(fetchError)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [pool])

  const playersLabel = `${pool.members} ${pool.members === 1 ? 'player' : 'players'}`
  const rankSummary =
    pool.yourRank != null ? `Your rank: ${ordinalPlace(pool.yourRank)}` : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted/40"
          aria-label="Back to pools"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl tracking-wide text-foreground">
            {pool.name}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {formatScoringStyleLabel(pool.scoringStyle)} · {playersLabel}
            {rankSummary ? ` · ${rankSummary}` : ''}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-3">
          <h2 className="font-display text-xl tracking-wide text-foreground">
            Standings
          </h2>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading standings…</p>
          ) : error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : standings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet</p>
          ) : (
            <ul className="space-y-2">
              {standings.map((row) => (
                <li
                  key={`${row.rank}-${row.name}`}
                  className={
                    row.isYou
                      ? 'flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3'
                      : 'flex items-center gap-3 rounded-lg border border-border bg-card p-3'
                  }
                >
                  <span className="w-8 shrink-0 text-center font-mono text-sm text-muted-foreground">
                    {row.rank}
                  </span>
                  <span
                    className={
                      row.isYou
                        ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground'
                        : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground'
                    }
                    aria-hidden
                  >
                    {memberInitials(row.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {row.name}
                    {row.isYou ? (
                      <span className="ml-1.5 text-xs text-primary">(you)</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                    {row.points} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
