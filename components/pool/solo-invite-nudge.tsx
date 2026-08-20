'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Users } from 'lucide-react'
import { useAuth } from '@/src/lib/auth-context'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { capturePostHog } from '@/src/lib/posthog-client'
import { trackEvent } from '@/src/lib/track'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

type SoloInviteNudgeProps = {
  inviteCode: string
  poolId: string
  memberCount: number
  acceptingMembers: boolean
}

/** Shown when a pool is near-empty (creator-only / 1–2 members). */
export function SoloInviteNudge({
  inviteCode,
  poolId,
  memberCount,
  acceptingMembers,
}: SoloInviteNudgeProps) {
  const { user } = useAuth()
  const shownRef = useRef(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!acceptingMembers || memberCount > 2 || shownRef.current) return
    shownRef.current = true
    capturePostHog('invite_nudge_shown', {
      pool_id: poolId,
      member_count: memberCount,
    })
  }, [acceptingMembers, memberCount, poolId])

  if (!acceptingMembers || memberCount > 2) return null

  async function copyInvite() {
    capturePostHog('invite_nudge_clicked', { pool_id: poolId })
    const url = buildJoinInviteUrl(
      window.location.origin,
      inviteCode,
      user?.id,
    )
    await navigator.clipboard.writeText(url)
    trackEvent('invite_link_copied', {
      poolId,
      metadata: { source: 'solo_nudge' },
    })
    capturePostHog('invite_link_copied', { pool_id: poolId })
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section
      className={cn(
        // Symmetric pb/pt looks uneven: Teko (font-display) ink overflows ~4px
        // above the line-box, eating into padding-top. Compensate so visual gap
        // above cap-height matches padding below the code row (12→16 / 16→20).
        'flex flex-col gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3 pb-3 pt-4 sm:gap-2.5 sm:px-4 sm:pb-4 sm:pt-5',
        FOCUS_VISIBLE_RING,
      )}
      aria-label="Invite friends to this pool"
    >
      <div className="m-0 flex items-center gap-2">
        <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <h3 className="m-0 min-w-0 truncate font-display text-base leading-none tracking-wide text-foreground sm:text-lg">
          This pool&apos;s quiet — invite friends
        </h3>
      </div>

      <div className="m-0 flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">
            /join/
          </span>
          <span className="truncate font-mono text-sm font-medium text-primary">
            {inviteCode}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void copyInvite()}
          aria-label={copied ? 'Copied' : 'Copy invite link'}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground',
            copied && 'text-primary',
            FOCUS_VISIBLE_RING,
          )}
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </section>
  )
}
