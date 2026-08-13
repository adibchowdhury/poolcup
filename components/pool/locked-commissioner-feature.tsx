'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'

type LockedCommissionerFeatureProps = {
  title: string
  description?: string
  /** Pool owner can upgrade; co-admins see informational copy only. */
  isOwner: boolean
  poolId?: string
  className?: string
}

/**
 * Locked Commissioner-only feature card for free-tier pools.
 * Shown only inside admin settings (owner or co-commissioner).
 */
export function LockedCommissionerFeature({
  title,
  description,
  isOwner,
  poolId,
  className,
}: LockedCommissionerFeatureProps) {
  useEffect(() => {
    capturePostHog('commissioner_feature_locked_viewed', {
      feature: title,
      pool_id: poolId ?? null,
      is_owner: isOwner,
    })
  }, [title, poolId, isOwner])

  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-muted/20 px-4 py-4',
        className,
      )}
      role="group"
      aria-label={`${title} — Commissioner feature, locked`}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground"
          aria-hidden
        >
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Commissioner feature
            {description ? ` — ${description}` : null}
          </p>
          {isOwner ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Upgrade to Commissioner to unlock these tools.
              </p>
              <Button
                asChild
                size="sm"
                className={cn('h-9', FOCUS_VISIBLE_RING)}
              >
                <Link
                  href="/settings/billing"
                  onClick={() => {
                    capturePostHog('upgrade_from_pool_prompt_clicked', {
                      feature: title,
                      pool_id: poolId ?? null,
                    })
                  }}
                >
                  Upgrade to Commissioner
                </Link>
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              These tools require the pool owner to have Commissioner.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
