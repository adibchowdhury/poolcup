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
import type { AdminPoolDetail } from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

export function AdminPoolDetailView({ poolId }: { poolId: string }) {
  const [detail, setDetail] = useState<AdminPoolDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/pools/${poolId}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as {
        detail?: AdminPoolDetail
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? `Failed to load pool (${res.status})`)
        setDetail(null)
      } else {
        setDetail(json.detail ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pool')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => {
    void load()
  }, [load])

  async function closePool() {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/pools/${poolId}/close`, {
        method: 'POST',
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setActionError(json.error ?? 'Close failed')
        return
      }
      capturePostHog('admin_pool_closed', { pool_id: poolId })
      setCloseOpen(false)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Close failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !detail) {
    return (
      <div className="flex justify-center py-12">
        <Loader2
          className="h-7 w-7 animate-spin text-primary"
          aria-label="Loading pool"
        />
      </div>
    )
  }

  if (error) {
    return <AdminErrorState message={error} onRetry={() => void load()} />
  }

  if (!detail?.pool) {
    return (
      <p className="text-sm text-muted-foreground">No results for this pool.</p>
    )
  }

  const pool = detail.pool

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/pools"
            className={cn(
              'rounded-md text-sm text-muted-foreground hover:text-foreground',
              FOCUS_VISIBLE_RING,
            )}
          >
            ← Pools
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            {pool.name ?? 'Pool'}
          </h2>
          <p className="text-sm text-muted-foreground">{pool.id}</p>
        </div>
        <Button
          type="button"
          variant="destructive"
          className={FOCUS_VISIBLE_RING}
          onClick={() => setCloseOpen(true)}
        >
          Close pool
        </Button>
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            ['Invite code', pool.invite_code],
            ['Public', pool.is_public ? 'Yes' : 'No'],
            ['Scoring style', pool.scoring_style],
            ['Event id', pool.event_id],
            ['Created', formatAdminWhen(pool.created_at)],
            ['Members', detail.member_count],
            ['Co-commissioners', detail.co_commissioners],
            ['Owner', detail.owner?.display_name],
            ['Owner email', detail.owner?.email],
            ['Owner tier', detail.owner?.tier],
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

      {detail.owner?.id ? (
        <p className="text-sm">
          <Link
            href={`/admin/users/${detail.owner.id}`}
            className={cn(
              'rounded-md text-primary hover:underline',
              FOCUS_VISIBLE_RING,
            )}
          >
            View owner profile →
          </Link>
        </p>
      ) : null}

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this pool?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing is an operator action logged in the audit trail. Confirm
              only if support has verified the request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                'bg-destructive text-white hover:bg-destructive/90',
                FOCUS_VISIBLE_RING,
              )}
              disabled={busy}
              onClick={(event) => {
                event.preventDefault()
                void closePool()
              }}
            >
              {busy ? 'Closing…' : 'Confirm close'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
