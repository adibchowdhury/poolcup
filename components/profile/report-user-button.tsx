'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AbuseReportDialog,
  type AbuseReportSubmitResult,
} from '@/components/abuse/abuse-report-dialog'
import { useAuth } from '@/src/lib/auth-context'
import { capturePostHog } from '@/src/lib/posthog-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { reportUser } from '@/src/lib/report-user'
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

  async function handleSubmit(payload: {
    reason: string
    context: string | null
    reasonPreset: string
  }): Promise<AbuseReportSubmitResult> {
    const { result, error } = await reportUser(
      supabase,
      profileUserId,
      payload.reason,
      'profile',
    )

    if (result === 'not_authenticated') {
      return { ok: false, code: 'not_authenticated' }
    }
    if (result === 'self') {
      return { ok: false, code: 'self' }
    }
    if (result === 'already_reported') {
      return { ok: false, code: 'already_reported' }
    }
    if (result === 'error') {
      return { ok: false, code: 'error', message: error ?? undefined }
    }

    capturePostHog('report_submitted', {
      reported_user_id: profileUserId,
      context: 'profile',
      reason_preset: payload.reasonPreset,
    })
    return { ok: true }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          'h-8 gap-1.5 text-muted-foreground',
          FOCUS_VISIBLE_RING,
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Report
      </Button>
      <AbuseReportDialog
        open={open}
        onOpenChange={setOpen}
        title="Report user"
        description="Tell us what's wrong. Reports are reviewed by the PoolCup team."
        alreadyReportedMessage="You already reported this profile"
        onSubmit={handleSubmit}
      />
    </>
  )
}
