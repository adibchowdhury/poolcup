'use client'

import { useState } from 'react'
import { Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  mintSignedShareImageUrl,
  shareOrCopy,
} from '@/src/lib/share-client'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

type SignedShareButtonProps = {
  type: 'prediction' | 'leaderboard'
  poolId: string
  matchId?: string
  /** Native share / clipboard destination link (not the image URL). */
  destinationUrl: string
  title: string
  text?: string
  label?: string
  className?: string
  size?: 'sm' | 'default'
  variant?: 'outline' | 'default' | 'ghost' | 'secondary'
}

/**
 * Session-mints a signed share-card image URL, then opens native share / copy.
 */
export function SignedShareButton({
  type,
  poolId,
  matchId,
  destinationUrl,
  title,
  text,
  label,
  className,
  size = 'sm',
  variant = 'outline',
}: SignedShareButtonProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultLabel =
    type === 'prediction' ? 'Share result' : 'Share my rank'

  async function handleShare() {
    setBusy(true)
    setError(null)
    try {
      const imageUrl = await mintSignedShareImageUrl({
        type,
        poolId,
        matchId,
      })
      capturePostHog('share_card_generated', { type })
      const absoluteUrl = destinationUrl.startsWith('http')
        ? destinationUrl
        : `${window.location.origin}${destinationUrl.startsWith('/') ? '' : '/'}${destinationUrl}`
      await shareOrCopy({
        title,
        text,
        url: absoluteUrl,
        imageUrl,
        type,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setBusy(false)
        return
      }
      setError('Could not share. Tap to retry.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={busy || !poolId}
        onClick={() => void handleShare()}
        className={cn('gap-1.5', FOCUS_VISIBLE_RING)}
        aria-busy={busy}
        aria-label={error ? `${defaultLabel} (retry)` : defaultLabel}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Share2 className="h-3.5 w-3.5" aria-hidden />
        )}
        {busy ? 'Preparing…' : error ? 'Retry share' : (label ?? defaultLabel)}
      </Button>
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
