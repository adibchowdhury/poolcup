'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AbuseReportDialog,
  type AbuseReportSubmitResult,
} from '@/components/abuse/abuse-report-dialog'
import { capturePostHog } from '@/src/lib/posthog-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

type ReportPoolControlProps = {
  poolId: string
  className?: string
  /** When set with onOpenChange, dialog is controlled (no built-in trigger). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Show the default outline button trigger (ignored when controlled without wanting trigger). */
  showTrigger?: boolean
}

export function ReportPoolControl({
  poolId,
  className,
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: ReportPoolControlProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const controlled = typeof openProp === 'boolean'
  const open = controlled ? openProp : uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  async function handleSubmit(payload: {
    reason: string
    context: string | null
    reasonPreset: string
  }): Promise<AbuseReportSubmitResult> {
    const res = await fetch(
      `/api/pools/${encodeURIComponent(poolId)}/report`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: payload.reason,
          context: payload.context,
        }),
      },
    )
    const json = (await res.json()) as { error?: string }

    if (res.status === 409 || json.error === 'already_reported') {
      return { ok: false, code: 'already_reported' }
    }
    if (res.status === 403 || json.error === 'user_banned') {
      return { ok: false, code: 'user_banned' }
    }
    if (res.status === 401) {
      return { ok: false, code: 'not_authenticated' }
    }
    if (!res.ok) {
      return {
        ok: false,
        code: 'error',
        message: json.error || 'Could not submit report',
      }
    }

    capturePostHog('pool_reported', {
      pool_id: poolId,
      reason_preset: payload.reasonPreset,
    })
    return { ok: true }
  }

  return (
    <>
      {showTrigger && !controlled ? (
        <Button
          type="button"
          variant="outline"
          className={cn(FOCUS_VISIBLE_RING, className)}
          onClick={() => setOpen(true)}
        >
          <Flag className="mr-2 h-4 w-4" aria-hidden />
          Report pool
        </Button>
      ) : null}
      <AbuseReportDialog
        open={open}
        onOpenChange={setOpen}
        title="Report pool"
        description="Tell us what's wrong with this pool. Reports are reviewed by the PoolCup team."
        alreadyReportedMessage="You already reported this pool recently."
        onSubmit={handleSubmit}
      />
    </>
  )
}
