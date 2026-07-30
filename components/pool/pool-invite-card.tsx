'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/src/lib/auth-context'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { trackEvent } from '@/src/lib/track'

type PoolInviteCardProps = {
  inviteCode: string
  poolId?: string
  className?: string
}

export function PoolInviteCard({
  inviteCode,
  poolId,
  className,
}: PoolInviteCardProps) {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  function copyInviteLink() {
    const joinUrl = buildJoinInviteUrl(
      window.location.origin,
      inviteCode,
      user?.id,
    )
    navigator.clipboard.writeText(joinUrl)
    trackEvent('invite_link_copied', {
      poolId: poolId ?? null,
      metadata: { source: 'pool_feed_empty' },
    })
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
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
        <Button
          type="button"
          onClick={copyInviteLink}
          variant={copied ? 'default' : 'outline'}
          className="shrink-0 gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy invite link
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
