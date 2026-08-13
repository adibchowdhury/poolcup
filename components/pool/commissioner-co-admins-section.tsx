'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Crown, Loader2, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { messageForCommissionerGate } from '@/src/lib/commissioner-entitlements'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'

type CoAdmin = {
  userId: string
  displayName: string | null
  username: string | null
}

type Props = {
  poolId: string
  ownerUserId: string
  members: LeaderboardMember[]
  initialCoAdmins?: CoAdmin[]
}

function labelFor(row: CoAdmin) {
  return row.displayName?.trim() || row.username?.trim() || row.userId.slice(0, 8)
}

export function CommissionerCoAdminsSection({
  poolId,
  ownerUserId,
  members,
  initialCoAdmins = [],
}: Props) {
  const [rows, setRows] = useState<CoAdmin[]>(initialCoAdmins)
  const [loading, setLoading] = useState(initialCoAdmins.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')

  const coAdminIds = useMemo(() => new Set(rows.map((r) => r.userId)), [rows])

  const candidates = useMemo(
    () =>
      members.filter(
        (m) =>
          m.userId &&
          m.userId !== ownerUserId &&
          !coAdminIds.has(m.userId),
      ),
    [members, ownerUserId, coAdminIds],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/pools/${encodeURIComponent(poolId)}/co-commissioners`,
      )
      const data = (await res.json()) as {
        coCommissioners?: CoAdmin[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Could not load co-commissioners')
      setRows(data.coCommissioners ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => {
    if (initialCoAdmins.length > 0) {
      setRows(initialCoAdmins)
      setLoading(false)
      return
    }
    void load()
  }, [initialCoAdmins, load])

  async function addCoAdmin() {
    if (!selectedUserId || busyUserId) return
    setBusyUserId(selectedUserId)
    try {
      const res = await fetch(
        `/api/pools/${encodeURIComponent(poolId)}/co-commissioners`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUserId }),
        },
      )
      const data = (await res.json()) as {
        coCommissioners?: CoAdmin[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Could not add')
      setRows(data.coCommissioners ?? [])
      setSelectedUserId('')
      capturePostHog('co_commissioner_added', { pool_id: poolId })
      capturePostHog('commissioner_action', {
        action: 'co_commissioner_added',
        pool_id: poolId,
      })
      toast.success('Co-commissioner added')
    } catch (err) {
      toast.error(
        messageForCommissionerGate(
          err,
          err instanceof Error ? err.message : 'Could not add',
        ),
      )
    } finally {
      setBusyUserId(null)
    }
  }

  async function removeCoAdmin(userId: string) {
    if (busyUserId) return
    setBusyUserId(userId)
    try {
      const res = await fetch(
        `/api/pools/${encodeURIComponent(poolId)}/co-commissioners`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        },
      )
      const data = (await res.json()) as {
        coCommissioners?: CoAdmin[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Could not remove')
      setRows(data.coCommissioners ?? [])
      capturePostHog('co_commissioner_removed', { pool_id: poolId })
      capturePostHog('commissioner_action', {
        action: 'co_commissioner_removed',
        pool_id: poolId,
      })
      toast.success('Co-commissioner removed')
    } catch (err) {
      toast.error(
        messageForCommissionerGate(
          err,
          err instanceof Error ? err.message : 'Could not remove',
        ),
      )
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-[#ffb300]" aria-hidden />
        <h3 className="font-display text-lg tracking-wide">Co-commissioners</h3>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Owner-only. Co-commissioners can edit pool settings, manage invites, and
        remove regular members — not delete the pool, transfer ownership, or
        manage admins.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn('mt-2', FOCUS_VISIBLE_RING)}
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              No co-commissioners yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.userId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/70 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{labelFor(row)}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Co-commissioner
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busyUserId === row.userId}
                    className={cn('gap-1.5 text-destructive', FOCUS_VISIBLE_RING)}
                    onClick={() => void removeCoAdmin(row.userId)}
                  >
                    {busyUserId === row.userId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <UserMinus className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="add-co-admin">
              Add co-commissioner
            </label>
            <select
              id="add-co-admin"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className={cn(
                'h-9 w-full rounded-md border border-border bg-background px-3 text-sm sm:flex-1',
                FOCUS_VISIBLE_RING,
              )}
              disabled={candidates.length === 0 || Boolean(busyUserId)}
            >
              <option value="">
                {candidates.length === 0
                  ? 'No eligible members'
                  : 'Select a member…'}
              </option>
              {candidates.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              disabled={!selectedUserId || Boolean(busyUserId)}
              className={cn('gap-1.5', FOCUS_VISIBLE_RING)}
              onClick={() => void addCoAdmin()}
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Add
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
