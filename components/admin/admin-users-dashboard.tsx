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
import type { AdminUserLookupRow } from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

export function AdminUsersDashboard() {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUserLookupRow[]>([])

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    setSearched(true)
    setLoading(true)
    setError(null)
    try {
      if (!trimmed) {
        setUsers([])
        return
      }
      const res = await fetch(
        `/api/admin/users/lookup?q=${encodeURIComponent(trimmed)}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as {
        users?: AdminUserLookupRow[]
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? `Search failed (${res.status})`)
        setUsers([])
      } else {
        setUsers(json.users ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setUsers([])
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
          placeholder="Search email, username, or display name"
          className={FOCUS_VISIBLE_RING}
          aria-label="Search users"
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
            aria-label="Searching users"
          />
        </div>
      ) : searched && !error && users.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No results
        </p>
      ) : users.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Username</th>
                <th className="px-3 py-3 font-medium">Display name</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Tier</th>
                <th className="px-3 py-3 font-medium">Banned</th>
                <th className="px-3 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className={cn(
                        'rounded-md font-medium text-primary hover:underline',
                        FOCUS_VISIBLE_RING,
                      )}
                    >
                      {user.username ?? '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{user.display_name ?? '—'}</td>
                  <td className="px-3 py-2.5 break-all">{user.email ?? '—'}</td>
                  <td className="px-3 py-2.5">{user.tier ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {user.banned ? (
                      <span className="text-destructive">Yes</span>
                    ) : (
                      'No'
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatAdminWhen(user.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter a query to look up users.
        </p>
      )}
    </div>
  )
}
