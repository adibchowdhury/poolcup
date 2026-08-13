'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, FileText, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { messageForCommissionerGate } from '@/src/lib/commissioner-entitlements'
import { capturePostHog } from '@/src/lib/posthog-client'

type ExportKind = 'leaderboard' | 'predictions'

type PoolExportsSectionProps = {
  poolId: string
  inviteCode?: string
}

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback
  const match = /filename="([^"]+)"/i.exec(header)
  return match?.[1] || fallback
}

export function PoolExportsSection({
  poolId,
  inviteCode,
}: PoolExportsSectionProps) {
  const [busy, setBusy] = useState<ExportKind | null>(null)
  const [lastKind, setLastKind] = useState<ExportKind>('leaderboard')
  const [error, setError] = useState<string | null>(null)
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)

  const printHref = inviteCode
    ? `/pool/${encodeURIComponent(inviteCode)}/print`
    : null

  async function downloadCsv(kind: ExportKind) {
    if (!poolId || busy) return
    setLastKind(kind)
    setBusy(kind)
    setError(null)
    setEmptyMessage(null)

    try {
      const path =
        kind === 'leaderboard'
          ? `/api/pools/${encodeURIComponent(poolId)}/export/leaderboard`
          : `/api/pools/${encodeURIComponent(poolId)}/export/predictions`

      const res = await fetch(path, { method: 'GET' })
      if (res.status === 401) {
        throw new Error('Sign in to export')
      }
      if (res.status === 403) {
        throw new Error('Only pool admins can export')
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error || 'Export failed')
      }

      const rowCount = Number(res.headers.get('X-Export-Row-Count') || '0')
      const isEmpty =
        res.headers.get('X-Export-Empty') === '1' || rowCount === 0

      if (isEmpty) {
        setEmptyMessage('No results to export yet')
        toast.message('No results to export yet')
        return
      }

      const blob = await res.blob()
      const fallback =
        kind === 'leaderboard'
          ? 'pool-leaderboard.csv'
          : 'pool-predictions.csv'
      const filename = filenameFromDisposition(
        res.headers.get('Content-Disposition'),
        fallback,
      )
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(objectUrl)

      capturePostHog(
        kind === 'leaderboard'
          ? 'export_leaderboard_csv'
          : 'export_predictions_csv',
        { pool_id: poolId },
      )
      toast.success(
        kind === 'leaderboard'
          ? 'Leaderboard CSV downloaded'
          : 'Predictions CSV downloaded',
      )
    } catch (err) {
      const message = messageForCommissionerGate(
        err,
        err instanceof Error ? err.message : 'Could not generate export',
      )
      setError(message)
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs text-muted-foreground">
        Download CSV files or open a printable view (use your browser’s Print →
        Save as PDF).
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn('h-9 justify-start sm:justify-center', FOCUS_VISIBLE_RING)}
          disabled={Boolean(busy)}
          aria-busy={busy === 'leaderboard'}
          onClick={() => void downloadCsv('leaderboard')}
        >
          {busy === 'leaderboard' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-2 h-4 w-4" aria-hidden />
          )}
          {busy === 'leaderboard'
            ? 'Generating…'
            : 'Export leaderboard (CSV)'}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn('h-9 justify-start sm:justify-center', FOCUS_VISIBLE_RING)}
          disabled={Boolean(busy)}
          aria-busy={busy === 'predictions'}
          onClick={() => void downloadCsv('predictions')}
        >
          {busy === 'predictions' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="mr-2 h-4 w-4" aria-hidden />
          )}
          {busy === 'predictions'
            ? 'Generating…'
            : 'Export prediction results (CSV)'}
        </Button>

        {printHref ? (
          <Button
            asChild
            type="button"
            size="sm"
            variant="outline"
            className={cn('h-9 justify-start sm:justify-center', FOCUS_VISIBLE_RING)}
          >
            <Link
              href={printHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              Printable / PDF view
            </Link>
          </Button>
        ) : null}
      </div>

      {emptyMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {emptyMessage}
        </p>
      ) : null}

      {error ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={cn('h-8', FOCUS_VISIBLE_RING)}
            disabled={Boolean(busy)}
            onClick={() => {
              setError(null)
              void downloadCsv(lastKind)
            }}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  )
}
