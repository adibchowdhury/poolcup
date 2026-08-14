'use client'

import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  REPORT_REASON_PRESETS,
  buildAbuseReportReason,
} from '@/src/lib/abuse-report'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

export type AbuseReportSubmitResult =
  | { ok: true }
  | {
      ok: false
      code?:
        | 'already_reported'
        | 'user_banned'
        | 'not_authenticated'
        | 'self'
        | 'error'
      message?: string
    }

type AbuseReportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Called with category as `reason` and optional free-text as `context`. */
  onSubmit: (payload: {
    reason: string
    context: string | null
    reasonPreset: string
  }) => Promise<AbuseReportSubmitResult>
  successMessage?: string
  alreadyReportedMessage?: string
}

export function AbuseReportDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  successMessage = 'Report submitted. Thanks for helping keep PoolCup safe.',
  alreadyReportedMessage = 'You already submitted a report recently.',
}: AbuseReportDialogProps) {
  const reasonId = useId()
  const detailsId = useId()
  const [reasonPreset, setReasonPreset] = useState<string>(
    REPORT_REASON_PRESETS[0],
  )
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setReasonPreset(REPORT_REASON_PRESETS[0])
    setDetails('')
    setError(null)
  }

  async function handleSubmit() {
    if (submitting) return
    const reason = buildAbuseReportReason(reasonPreset, details)
    if (!reason) {
      setError('Please choose or enter a reason')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await onSubmit({
        reason,
        context: details.trim() || null,
        reasonPreset,
      })
      if (!result.ok) {
        if (result.code === 'already_reported') {
          toast.message(alreadyReportedMessage)
          onOpenChange(false)
          resetForm()
          return
        }
        if (result.code === 'user_banned') {
          setError('Your account can’t submit reports right now.')
          return
        }
        if (result.code === 'not_authenticated') {
          setError('Sign in to submit a report.')
          return
        }
        if (result.code === 'self') {
          setError("You can't report yourself.")
          return
        }
        setError(result.message || 'Could not submit report')
        return
      }

      toast.success(successMessage)
      onOpenChange(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return
        onOpenChange(next)
        if (!next) resetForm()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={reasonId}>Reason</Label>
            <select
              id={reasonId}
              value={reasonPreset}
              onChange={(e) => setReasonPreset(e.target.value)}
              disabled={submitting}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm',
                FOCUS_VISIBLE_RING,
              )}
            >
              {REPORT_REASON_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={detailsId}>
              {reasonPreset === 'Other' ? 'Details' : 'More details (optional)'}
            </Label>
            <Textarea
              id={detailsId}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything that helps us review this report…"
              rows={3}
              maxLength={500}
              disabled={submitting}
              className={FOCUS_VISIBLE_RING}
            />
          </div>
          {error ? (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={FOCUS_VISIBLE_RING}
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                Retry
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={FOCUS_VISIBLE_RING}
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={FOCUS_VISIBLE_RING}
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              'Submit report'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
