'use client'

import { useCallback, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import {
  AdminErrorState,
  formatAdminWhen,
} from '@/components/admin/admin-shell'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminMatchLookupRow } from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

export function AdminMatchesDashboard() {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<AdminMatchLookupRow[]>([])
  const [refreshId, setRefreshId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    setSearched(true)
    setLoading(true)
    setError(null)
    try {
      if (!trimmed) {
        setMatches([])
        return
      }
      const res = await fetch(
        `/api/admin/matches/lookup?q=${encodeURIComponent(trimmed)}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as {
        matches?: AdminMatchLookupRow[]
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? `Search failed (${res.status})`)
        setMatches([])
      } else {
        setMatches(json.matches ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setMatches([])
    } finally {
      setLoading(false)
    }
  }, [])

  async function refreshScoring(matchId: string) {
    setBusyId(matchId)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/refresh`, {
        method: 'POST',
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setActionError(json.error ?? 'Refresh failed')
        return
      }
      capturePostHog('admin_match_refreshed', { match_id: matchId })
      setRefreshId(null)
      await runSearch(query)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void runSearch(query)
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search team names or match id"
          className={FOCUS_VISIBLE_RING}
          aria-label="Search matches"
        />
        <Button
          type="submit"
          className={cn('gap-2', FOCUS_VISIBLE_RING)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Search className="h-4 w-4" aria-hidden />
          )}
          Search
        </Button>
      </form>

      {error ? (
        <AdminErrorState
          message={error}
          onRetry={() => void runSearch(query)}
        />
      ) : null}

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2
            className="h-7 w-7 animate-spin text-primary"
            aria-label="Searching matches"
          />
        </div>
      ) : searched && !error && matches.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No results
        </p>
      ) : matches.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Teams</th>
                <th className="px-3 py-3 font-medium">Result</th>
                <th className="px-3 py-3 font-medium">Final</th>
                <th className="px-3 py-3 font-medium">Kickoff</th>
                <th className="px-3 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => {
                const result =
                  match.result_team1 == null || match.result_team2 == null
                    ? '—'
                    : `${match.result_team1}–${match.result_team2}`
                return (
                  <tr
                    key={match.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-3 py-2.5">
                      <div>
                        {match.team1_name ?? '—'} vs {match.team2_name ?? '—'}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {match.id}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{result}</td>
                    <td className="px-3 py-2.5">
                      {match.is_final ? 'Yes' : 'No'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {formatAdminWhen(match.kickoff_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={FOCUS_VISIBLE_RING}
                        onClick={() => setRefreshId(match.id)}
                      >
                        Refresh scoring
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter a query to look up matches.
        </p>
      )}

      <AlertDialog
        open={Boolean(refreshId)}
        onOpenChange={(open) => {
          if (!open) setRefreshId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh scoring for this match?</AlertDialogTitle>
            <AlertDialogDescription>
              Re-runs scoring for the match. Confirm only if results look wrong
              or scoring stalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={FOCUS_VISIBLE_RING}
              disabled={busyId != null || !refreshId}
              onClick={(event) => {
                event.preventDefault()
                if (refreshId) void refreshScoring(refreshId)
              }}
            >
              {busyId ? 'Refreshing…' : 'Confirm refresh'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
