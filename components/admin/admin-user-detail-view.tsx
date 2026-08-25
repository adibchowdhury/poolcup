'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import type { AdminUserDetail } from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

export function AdminUserDetailView({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [banOpen, setBanOpen] = useState(false)
  const [unbanOpen, setUnbanOpen] = useState(false)
  const [banReason, setBanReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as {
        detail?: AdminUserDetail
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? `Failed to load user (${res.status})`)
        setDetail(null)
      } else {
        setDetail(json.detail ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function banUser() {
    const reason = banReason.trim()
    if (!reason) {
      setActionError('A ban reason is required.')
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const json = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        setActionError(json.message ?? json.error ?? 'Ban failed')
        return
      }
      capturePostHog('admin_user_banned', { user_id: userId })
      setBanOpen(false)
      setBanReason('')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ban failed')
    } finally {
      setBusy(false)
    }
  }

  async function unbanUser() {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setActionError(json.error ?? 'Unban failed')
        return
      }
      capturePostHog('admin_user_unbanned', { user_id: userId })
      setUnbanOpen(false)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unban failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !detail) {
    return (
      <div className="flex justify-center py-12">
        <Loader2
          className="h-7 w-7 animate-spin text-primary"
          aria-label="Loading user"
        />
      </div>
    )
  }

  if (error) {
    return <AdminErrorState message={error} onRetry={() => void load()} />
  }

  if (!detail?.profile) {
    return (
      <p className="text-sm text-muted-foreground">No results for this user.</p>
    )
  }

  const profile = detail.profile
  const banned = Boolean(profile.banned)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/users"
            className={cn(
              'rounded-md text-sm text-muted-foreground hover:text-foreground',
              FOCUS_VISIBLE_RING,
            )}
          >
            ← Users
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            {profile.display_name ?? profile.username ?? profile.email ?? 'User'}
          </h2>
          <p className="text-sm text-muted-foreground">{profile.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {banned ? (
            <Button
              type="button"
              variant="outline"
              className={FOCUS_VISIBLE_RING}
              onClick={() => setUnbanOpen(true)}
            >
              Unban
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className={FOCUS_VISIBLE_RING}
              onClick={() => setBanOpen(true)}
            >
              Ban
            </Button>
          )}
        </div>
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            ['Username', profile.username],
            ['Display name', profile.display_name],
            ['Email', profile.email],
            ['Stripe customer', profile.stripe_customer_id],
            ['Banned', banned ? 'Yes' : 'No'],
            ['Points', profile.points],
            ['Created', formatAdminWhen(profile.created_at)],
            ['Last active', formatAdminWhen(profile.last_active_at)],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border/70 px-3 py-2"
          >
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-0.5 break-all text-sm text-foreground">
              {value == null || value === '' ? '—' : String(value)}
            </dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Pools owned ({detail.pools_owned?.length ?? 0})
        </h3>
        {(detail.pools_owned?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No owned pools.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detail.pools_owned.map((pool) => (
              <li key={pool.id}>
                <Link
                  href={`/admin/pools/${pool.id}`}
                  className={cn(
                    'rounded-md text-primary hover:underline',
                    FOCUS_VISIBLE_RING,
                  )}
                >
                  {pool.name ?? pool.id}
                </Link>
                {pool.plan === 'custom' ? (
                  <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                    Custom Pool
                  </span>
                ) : null}
                <span className="ml-2 text-muted-foreground">
                  {formatAdminWhen(pool.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Pools joined: {detail.pools_joined_count ?? 0}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Recent predictions
        </h3>
        {(detail.recent_predictions?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No results</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Match</th>
                  <th className="px-3 py-2 font-medium">Pred</th>
                  <th className="px-3 py-2 font-medium">Points</th>
                  <th className="px-3 py-2 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {detail.recent_predictions.map((row, index) => (
                  <tr
                    key={`${row.match_id}-${index}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.match_id}
                    </td>
                    <td className="px-3 py-2">{row.pred}</td>
                    <td className="px-3 py-2">{row.points ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatAdminWhen(row.submitted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AlertDialog open={banOpen} onOpenChange={setBanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the account as banned. Provide a reason for the audit
              log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block text-sm" htmlFor="ban-reason">
            Reason
            <Input
              id="ban-reason"
              className={cn('mt-1', FOCUS_VISIBLE_RING)}
              value={banReason}
              onChange={(event) => setBanReason(event.target.value)}
              placeholder="Spam, abuse, etc."
              disabled={busy}
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonDestructiveClass, FOCUS_VISIBLE_RING)}
              disabled={busy || !banReason.trim()}
              onClick={(event) => {
                event.preventDefault()
                void banUser()
              }}
            >
              {busy ? 'Banning…' : 'Confirm ban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unbanOpen} onOpenChange={setUnbanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unban this user?</AlertDialogTitle>
            <AlertDialogDescription>
              The account will regain normal access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={FOCUS_VISIBLE_RING}
              disabled={busy}
              onClick={(event) => {
                event.preventDefault()
                void unbanUser()
              }}
            >
              {busy ? 'Unbanning…' : 'Confirm unban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const buttonDestructiveClass =
  'bg-destructive text-white hover:bg-destructive/90'
