'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Flag, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/src/lib/auth-context'
import { capturePostHog } from '@/src/lib/posthog-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  REPORT_REASON_PRESETS,
  reportUser,
} from '@/src/lib/report-user'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'

type ReportUserButtonProps = {
  profileUserId: string
  className?: string
}

export function ReportUserButton({
  profileUserId,
  className,
}: ReportUserButtonProps) {
  const { user, loading: authLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [reasonPreset, setReasonPreset] = useState<string>(
    REPORT_REASON_PRESETS[0],
  )
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (authLoading) return null
  if (user?.id === profileUserId) return null

  if (!user) {
    const next = typeof window !== 'undefined' ? window.location.pathname : '/u'
    return (
      <Button
        asChild
        size="sm"
        variant="ghost"
        className={cn('h-8 gap-1.5 text-muted-foreground', FOCUS_VISIBLE_RING, className)}
      >
        <Link href={`/login?next=${encodeURIComponent(next)}`}>
          <Flag className="h-3.5 w-3.5" aria-hidden />
          Report
        </Link>
      </Button>
    )
  }

  async function handleSubmit() {
    if (submitting) return
    const reason =
      reasonPreset === 'Other'
        ? details.trim()
        : details.trim()
          ? `${reasonPreset}: ${details.trim()}`
          : reasonPreset

    if (!reason) {
      toast.error('Please choose or enter a reason')
      return
    }

    setSubmitting(true)
    const { result, error } = await reportUser(
      supabase,
      profileUserId,
      reason,
      'profile',
    )
    setSubmitting(false)

    if (result === 'not_authenticated') {
      toast.error('Sign in to report a user')
      return
    }
    if (result === 'self') {
      toast.error("You can't report yourself")
      return
    }
    if (result === 'already_reported') {
      toast.message('You already reported this profile')
      setOpen(false)
      return
    }
    if (result === 'error') {
      toast.error(error || 'Could not submit report')
      return
    }

    capturePostHog('report_submitted', {
      reported_user_id: profileUserId,
      context: 'profile',
      reason_preset: reasonPreset,
    })
    toast.success('Report submitted. Thanks for helping keep PoolCup safe.')
    setOpen(false)
    setDetails('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn(
            'h-8 gap-1.5 text-muted-foreground',
            FOCUS_VISIBLE_RING,
            className,
          )}
        >
          <Flag className="h-3.5 w-3.5" aria-hidden />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report user</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s wrong. Reports are reviewed by the PoolCup team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="report-reason">Reason</Label>
            <select
              id="report-reason"
              value={reasonPreset}
              onChange={(e) => setReasonPreset(e.target.value)}
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
            <Label htmlFor="report-details">
              {reasonPreset === 'Other' ? 'Details' : 'More details (optional)'}
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything that helps us review this report…"
              rows={3}
              className={FOCUS_VISIBLE_RING}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={FOCUS_VISIBLE_RING}
            onClick={() => setOpen(false)}
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
