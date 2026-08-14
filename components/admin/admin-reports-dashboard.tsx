'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import type {
  AdminReportQueueRow,
  AdminReportStatusFilter,
  AdminReportTypeFilter,
} from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: Array<{ value: AdminReportStatusFilter; label: string }> =
  [
    { value: 'open', label: 'Open' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'all', label: 'All' },
  ]

const TYPE_OPTIONS: Array<{ value: AdminReportTypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'user', label: 'User' },
  { value: 'message', label: 'Message' },
  { value: 'pool', label: 'Pool' },
]

function typeBadgeClass(type: string): string {
  if (type === 'user') return 'bg-sky-500/15 text-sky-300'
  if (type === 'message') return 'bg-amber-500/15 text-amber-300'
  if (type === 'pool') return 'bg-violet-500/15 text-violet-300'
  return 'bg-muted text-muted-foreground'
}

export function AdminReportsDashboard() {
  const [status, setStatus] = useState<AdminReportStatusFilter>('open')
  const [type, setType] = useState<AdminReportTypeFilter>('all')
  const [reports, setReports] = useState<AdminReportQueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [resolveOpen, setResolveOpen] = useState(false)
  const [resolveTarget, setResolveTarget] =
    useState<AdminReportQueueRow | null>(null)
  const [resolveNote, setResolveNote] = useState('')

  const [banOpen, setBanOpen] = useState(false)
  const [banTarget, setBanTarget] = useState<AdminReportQueueRow | null>(null)
  const [banReason, setBanReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        status,
        type,
        limit: '100',
      })
      const res = await fetch(`/api/admin/reports?${qs.toString()}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as {
        reports?: AdminReportQueueRow[]
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? `Failed to load (${res.status})`)
        setReports([])
      } else {
        setReports(json.reports ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [status, type])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    capturePostHog('admin_report_queue_viewed', { status, type })
  }, [status, type])

  async function resolveReport(
    row: AdminReportQueueRow,
    note: string | null,
  ): Promise<boolean> {
    const res = await fetch('/api/admin/reports/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType: row.report_type,
        reportId: row.report_id,
        note,
      }),
    })
    const json = (await res.json()) as { error?: string }
    if (!res.ok) {
      setActionError(json.error ?? 'Resolve failed')
      return false
    }
    capturePostHog('admin_report_resolved', {
      report_type: row.report_type,
      report_id: row.report_id,
    })
    return true
  }

  async function confirmResolve() {
    if (!resolveTarget) return
    setBusyId(resolveTarget.report_id)
    setActionError(null)
    try {
      const note = resolveNote.trim() || null
      const ok = await resolveReport(resolveTarget, note)
      if (!ok) return
      setResolveOpen(false)
      setResolveTarget(null)
      setResolveNote('')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Resolve failed')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmBanAndResolve() {
    if (!banTarget || banTarget.report_type !== 'user' || !banTarget.target_id) {
      return
    }
    const reason = banReason.trim()
    if (!reason) {
      setActionError('A ban reason is required.')
      return
    }

    setBusyId(banTarget.report_id)
    setActionError(null)
    try {
      const banRes = await fetch(
        `/api/admin/users/${encodeURIComponent(banTarget.target_id)}/ban`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        },
      )
      const banJson = (await banRes.json()) as {
        error?: string
        message?: string
      }
      if (!banRes.ok) {
        setActionError(banJson.message ?? banJson.error ?? 'Ban failed')
        return
      }

      capturePostHog('admin_report_ban_action', {
        report_id: banTarget.report_id,
        target_user_id: banTarget.target_id,
      })

      const ok = await resolveReport(
        banTarget,
        `Banned user: ${reason}`.slice(0, 1000),
      )
      if (!ok) return

      setBanOpen(false)
      setBanTarget(null)
      setBanReason('')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ban failed')
    } finally {
      setBusyId(null)
    }
  }

  const emptyMessage =
    status === 'open'
      ? 'No open reports'
      : status === 'resolved'
        ? 'No resolved reports'
        : 'No reports'

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Abuse reports from users (profiles, chat messages, pools). Resolve with
        an optional note; ban is available for user reports.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </legend>
            <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium capitalize',
                    FOCUS_VISIBLE_RING,
                    status === option.value
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-pressed={status === option.value}
                  onClick={() => setStatus(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Type
            </legend>
            <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium capitalize',
                    FOCUS_VISIBLE_RING,
                    type === option.value
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-pressed={type === option.value}
                  onClick={() => setType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('gap-2 self-start sm:self-auto', FOCUS_VISIBLE_RING)}
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          Refresh
        </Button>
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {error ? (
        <AdminErrorState message={error} onRetry={() => void load()} />
      ) : loading && reports.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2
            className="h-7 w-7 animate-spin text-primary"
            aria-label="Loading reports"
          />
        </div>
      ) : reports.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Reporter</th>
                <th className="px-3 py-3 font-medium">Target</th>
                <th className="px-3 py-3 font-medium">Reason</th>
                <th className="px-3 py-3 font-medium">Context</th>
                <th className="px-3 py-3 font-medium">Created</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((row) => {
                const isOpen = (row.status ?? '').toLowerCase() === 'open'
                const busy = busyId === row.report_id
                return (
                  <tr
                    key={`${row.report_type}-${row.report_id}`}
                    className="border-b border-border/60 last:border-0 align-top"
                  >
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                          typeBadgeClass(row.report_type),
                        )}
                      >
                        {row.report_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {row.reporter_id ? (
                        <Link
                          href={`/admin/users/${row.reporter_id}`}
                          className={cn(
                            'rounded-md text-primary hover:underline',
                            FOCUS_VISIBLE_RING,
                          )}
                        >
                          {row.reporter_name ?? row.reporter_id.slice(0, 8)}
                        </Link>
                      ) : (
                        (row.reporter_name ?? '—')
                      )}
                    </td>
                    <td className="px-3 py-2.5 max-w-xs break-words">
                      {row.report_type === 'user' && row.target_id ? (
                        <Link
                          href={`/admin/users/${row.target_id}`}
                          className={cn(
                            'rounded-md text-primary hover:underline',
                            FOCUS_VISIBLE_RING,
                          )}
                        >
                          {row.target_label ?? row.target_id}
                        </Link>
                      ) : row.report_type === 'pool' && row.target_id ? (
                        <Link
                          href={`/admin/pools/${row.target_id}`}
                          className={cn(
                            'rounded-md text-primary hover:underline',
                            FOCUS_VISIBLE_RING,
                          )}
                        >
                          {row.target_label ?? row.target_id}
                        </Link>
                      ) : (
                        <span className="text-foreground">
                          {row.target_label ?? row.target_id ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 max-w-xs break-words">
                      {row.reason ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">{row.context ?? '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {formatAdminWhen(row.created_at)}
                    </td>
                    <td className="px-3 py-2.5 capitalize">
                      {row.status ?? '—'}
                      {row.resolution_note ? (
                        <p className="mt-1 text-xs text-muted-foreground break-words">
                          {row.resolution_note}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      {isOpen ? (
                        <div className="flex flex-col gap-1.5 sm:flex-row">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={FOCUS_VISIBLE_RING}
                            disabled={busy}
                            onClick={() => {
                              setActionError(null)
                              setResolveTarget(row)
                              setResolveNote('')
                              setResolveOpen(true)
                            }}
                          >
                            Resolve
                          </Button>
                          {row.report_type === 'user' && row.target_id ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className={FOCUS_VISIBLE_RING}
                              disabled={busy}
                              onClick={() => {
                                setActionError(null)
                                setBanTarget(row)
                                setBanReason(
                                  row.reason?.trim()
                                    ? `Report: ${row.reason.trim()}`.slice(
                                        0,
                                        200,
                                      )
                                    : 'Banned from report queue',
                                )
                                setBanOpen(true)
                              }}
                            >
                              Ban user
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={resolveOpen}
        onOpenChange={(open) => {
          setResolveOpen(open)
          if (!open) {
            setResolveTarget(null)
            setResolveNote('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve report?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this {resolveTarget?.report_type ?? 'report'} as resolved.
              Optionally add an action note for the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block text-sm" htmlFor="resolve-note">
            Action note (optional)
            <Textarea
              id="resolve-note"
              className={cn('mt-1', FOCUS_VISIBLE_RING)}
              value={resolveNote}
              onChange={(event) => setResolveNote(event.target.value)}
              placeholder="Warned user, no action needed, etc."
              rows={3}
              disabled={busyId != null}
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={FOCUS_VISIBLE_RING}
              disabled={busyId != null || !resolveTarget}
              onClick={(event) => {
                event.preventDefault()
                void confirmResolve()
              }}
            >
              {busyId ? 'Resolving…' : 'Confirm resolve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={banOpen}
        onOpenChange={(open) => {
          setBanOpen(open)
          if (!open) {
            setBanTarget(null)
            setBanReason('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban reported user?</AlertDialogTitle>
            <AlertDialogDescription>
              Bans the reported account and resolves this report. Provide a
              reason for the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block text-sm" htmlFor="ban-from-report-reason">
            Ban reason
            <Textarea
              id="ban-from-report-reason"
              className={cn('mt-1', FOCUS_VISIBLE_RING)}
              value={banReason}
              onChange={(event) => setBanReason(event.target.value)}
              rows={3}
              disabled={busyId != null}
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                'bg-destructive text-white hover:bg-destructive/90',
                FOCUS_VISIBLE_RING,
              )}
              disabled={busyId != null || !banReason.trim() || !banTarget}
              onClick={(event) => {
                event.preventDefault()
                void confirmBanAndResolve()
              }}
            >
              {busyId ? 'Banning…' : 'Ban and resolve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
