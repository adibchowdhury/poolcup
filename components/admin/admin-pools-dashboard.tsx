'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import {
  AdminErrorState,
  formatAdminWhen,
} from '@/components/admin/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminPoolLookupRow } from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

export function AdminPoolsDashboard() {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pools, setPools] = useState<AdminPoolLookupRow[]>([])

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    setSearched(true)
    setLoading(true)
    setError(null)
    try {
      if (!trimmed) {
        setPools([])
        return
      }
      const res = await fetch(
        `/api/admin/pools/lookup?q=${encodeURIComponent(trimmed)}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as {
        pools?: AdminPoolLookupRow[]
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? `Search failed (${res.status})`)
        setPools([])
      } else {
        setPools(json.pools ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setPools([])
    } finally {
      setLoading(false)
    }
  }, [])

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
          placeholder="Search pool name or invite code"
          className={FOCUS_VISIBLE_RING}
          aria-label="Search pools"
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2
            className="h-7 w-7 animate-spin text-primary"
            aria-label="Searching pools"
          />
        </div>
      ) : searched && !error && pools.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No results
        </p>
      ) : pools.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Invite code</th>
                <th className="px-3 py-3 font-medium">Owner</th>
                <th className="px-3 py-3 font-medium">Members</th>
                <th className="px-3 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((pool) => (
                <tr
                  key={pool.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/pools/${pool.id}`}
                      className={cn(
                        'rounded-md font-medium text-primary hover:underline',
                        FOCUS_VISIBLE_RING,
                      )}
                    >
                      {pool.name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {pool.invite_code ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">{pool.creator_name ?? '—'}</td>
                  <td className="px-3 py-2.5">{pool.member_count ?? 0}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatAdminWhen(pool.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter a query to look up pools.
        </p>
      )}
    </div>
  )
}
