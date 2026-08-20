'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressHeader } from '@/components/predict/progress-header'
import { useAuth } from '@/src/lib/auth-context'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { shareOrCopy } from '@/src/lib/share-client'
import { capturePostHog } from '@/src/lib/posthog-client'
import { trackEvent } from '@/src/lib/track'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

type PoolPredictionsDesktopSidebarProps = {
  predictedCount: number
  totalMatchCount: number
  memberCount: number
  /** 1-based leaderboard rank from existing members cache; null if unknown. */
  userRank: number | null
  inviteCode: string
  poolId: string
  poolName: string
  acceptingMembers: boolean
  className?: string
}

/** lg+ predictions context column — overview + invite (no new data fetches). */
export function PoolPredictionsDesktopSidebar({
  predictedCount,
  totalMatchCount,
  memberCount,
  userRank,
  inviteCode,
  poolId,
  poolName,
  acceptingMembers,
  className,
}: PoolPredictionsDesktopSidebarProps) {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function joinUrl() {
    return buildJoinInviteUrl(window.location.origin, inviteCode, user?.id)
  }

  async function copyInviteLink() {
    const url = joinUrl()
    await navigator.clipboard.writeText(url)
    trackEvent('invite_link_copied', {
      poolId,
      metadata: { source: 'predictions_sidebar' },
    })
    capturePostHog('invite_link_copied', { pool_id: poolId })
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function shareInvite() {
    setBusy(true)
    setError(null)
    const url = joinUrl()
    try {
      capturePostHog('share_card_generated', { type: 'pool_invite' })
      await shareOrCopy({
        title: poolName ? `Join ${poolName} on PoolCup` : 'Join my PoolCup pool',
        text: 'Join my prediction pool on PoolCup',
        url,
        imageUrl: `/api/share/pool/${encodeURIComponent(inviteCode)}`,
        type: 'pool_invite',
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setBusy(false)
        return
      }
      try {
        await copyInviteLink()
      } catch {
        setError('Could not share or copy link')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside
      className={cn(
        'hidden min-w-0 flex-col gap-4 lg:flex lg:w-auto',
        'lg:sticky lg:top-24 lg:max-h-[calc(100dvh-6.5rem)] lg:self-start lg:overflow-y-auto lg:pb-24',
        className,
      )}
      aria-label="Pool predictions context"
    >
      <section className="min-w-0 rounded-xl border border-border/80 bg-card/40 p-3">
        <h3 className="font-display text-sm tracking-wide text-muted-foreground uppercase">
          Pool overview
        </h3>
        <ProgressHeader
          current={predictedCount}
          total={totalMatchCount}
          headline={`${predictedCount} / ${totalMatchCount} predicted`}
          className="mt-3"
        />
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <dt className="min-w-0 truncate text-muted-foreground">Members</dt>
            <dd className="shrink-0 font-mono tabular-nums text-foreground">
              {memberCount}
            </dd>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <dt className="min-w-0 truncate text-muted-foreground">Your position</dt>
            <dd className="shrink-0 font-mono tabular-nums text-foreground">
              {userRank != null && userRank > 0 ? `You're #${userRank}` : '—'}
            </dd>
          </div>
        </dl>
      </section>

      {acceptingMembers ? (
        <section className="min-w-0 rounded-xl border border-border/80 bg-card/40 p-3">
          <h3 className="font-display text-sm tracking-wide text-muted-foreground uppercase">
            Invite friends
          </h3>
          {memberCount <= 2 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              This pool&apos;s quiet — invite friends
            </p>
          ) : null}

          <div className="mt-3 flex w-full min-w-0 flex-col gap-2">
            <Button
              type="button"
              onClick={() => void shareInvite()}
              disabled={busy}
              className={cn('h-10 w-full gap-2', FOCUS_VISIBLE_RING)}
            >
              <Share2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Share Pool</span>
            </Button>

            <button
              type="button"
              onClick={() => void copyInviteLink()}
              className={cn(
                'flex w-full min-w-0 flex-col items-stretch gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-2 text-left transition-colors hover:bg-muted',
                FOCUS_VISIBLE_RING,
              )}
              aria-label={
                copied ? 'Invite link copied' : 'Copy invite link'
              }
            >
              <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
                {copied ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 truncate">
                  {copied ? 'Copied!' : 'Copy invite link'}
                </span>
              </span>
              <span className="truncate font-mono text-xs text-primary">
                /join/{inviteCode}
              </span>
            </button>

            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </aside>
  )
}
