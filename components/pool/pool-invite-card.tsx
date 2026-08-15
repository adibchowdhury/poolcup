'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/src/lib/auth-context'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { downloadShareImage, shareOrCopy } from '@/src/lib/share-client'
import { capturePostHog } from '@/src/lib/posthog-client'
import { trackEvent } from '@/src/lib/track'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

type PoolInviteCardProps = {
  inviteCode: string
  poolId?: string
  poolName?: string
  className?: string
  /** Analytics source tag */
  source?: string
}

export function PoolInviteCard({
  inviteCode,
  poolId,
  poolName,
  className,
  source = 'pool_invite_card',
}: PoolInviteCardProps) {
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
      poolId: poolId ?? null,
      metadata: { source },
    })
    if (poolId) {
      capturePostHog('invite_link_copied', { pool_id: poolId })
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function shareInvite() {
    setBusy(true)
    setError(null)
    const url = joinUrl()
    const imageUrl = `/api/share/pool/${encodeURIComponent(inviteCode)}`
    try {
      capturePostHog('share_card_generated', { type: 'pool_invite' })
      await shareOrCopy({
        title: poolName ? `Join ${poolName} on PoolCup` : 'Join my PoolCup pool',
        text: 'Join my prediction pool on PoolCup',
        url,
        imageUrl,
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

  async function downloadCard() {
    setBusy(true)
    setError(null)
    try {
      capturePostHog('share_card_generated', { type: 'pool_invite' })
      await downloadShareImage(
        `/api/share/pool/${encodeURIComponent(inviteCode)}`,
        `poolcup-invite-${inviteCode}.png`,
        'pool_invite',
      )
    } catch {
      setError('Could not download invite card')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3">
          <span className="shrink-0 text-sm text-muted-foreground">/join/</span>
          <span className="truncate font-mono font-medium text-primary">
            {inviteCode}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void shareInvite()}
            disabled={busy}
            className={cn('gap-2', FOCUS_VISIBLE_RING)}
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Share
          </Button>
          <Button
            type="button"
            onClick={() => void copyInviteLink()}
            variant={copied ? 'default' : 'outline'}
            className={cn('gap-2', FOCUS_VISIBLE_RING)}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden />
                Copy link
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void downloadCard()}
            className={FOCUS_VISIBLE_RING}
          >
            Download card
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
