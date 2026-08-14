'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, Loader2 } from 'lucide-react'
import type { ReferralPerformanceRow } from '@/app/admin/referrals/page'
import { AdminErrorState } from '@/components/admin/admin-shell'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

type SortKey =
  | 'signups_referred'
  | 'pool_joins_driven'
  | 'invite_xp_earned'
  | 'referrer_name'

export function AdminReferralsDashboard({
  initialRows,
  initialError,
}: {
  initialRows: ReferralPerformanceRow[]
  initialError: string | null
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('signups_referred')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    capturePostHog('referral_admin_viewed', { row_count: initialRows.length })
  }, [initialRows.length])

  useEffect(() => {
    setRows(initialRows)
    setError(initialError)
    setLoading(false)
  }, [initialRows, initialError])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    router.refresh()
  }, [router])

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av =
        sortKey === 'referrer_name'
          ? (a.referrer_name ?? a.referrer_username ?? '').toLowerCase()
          : Number(a[sortKey]) || 0
      const bv =
        sortKey === 'referrer_name'
          ? (b.referrer_name ?? b.referrer_username ?? '').toLowerCase()
          : Number(b[sortKey]) || 0
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [rows, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'referrer_name' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Signups referred, pool joins driven, and invite XP.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2
            className="h-7 w-7 animate-spin text-primary"
            aria-label="Loading"
          />
        </div>
      ) : error ? (
        <AdminErrorState message={error} onRetry={reload} />
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/70 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No referral activity yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {(
                  [
                    ['referrer_name', 'Referrer'],
                    ['signups_referred', 'Signups'],
                    ['pool_joins_driven', 'Pool joins'],
                    ['invite_xp_earned', 'Invite XP'],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-3 font-medium">
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1 hover:text-foreground',
                        FOCUS_VISIBLE_RING,
                      )}
                      onClick={() => toggleSort(key)}
                    >
                      {label}
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {sorted.map((row) => (
                <tr key={row.referrer_id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/u/${row.referrer_id}`}
                      className={cn(
                        'text-primary hover:underline',
                        FOCUS_VISIBLE_RING,
                      )}
                    >
                      {row.referrer_name ||
                        row.referrer_username ||
                        row.referrer_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.signups_referred}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.pool_joins_driven}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.invite_xp_earned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
