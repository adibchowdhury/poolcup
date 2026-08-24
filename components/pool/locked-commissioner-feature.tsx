'use client'

import { useEffect, useState } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { startCustomPoolCheckout } from '@/src/lib/custom-pool-checkout-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog, paywallFeatureKey } from '@/src/lib/posthog-client'

type LockedCommissionerFeatureProps = {
  title: string
  description?: string
  /** Pool owner can upgrade; co-admins see informational copy only. */
  isOwner: boolean
  poolId?: string
  className?: string
}

/**
 * Locked Custom Pool feature card for basic pools.
 * Shown only inside admin settings (owner or co-commissioner).
 */
export function LockedCommissionerFeature({
  title,
  description,
  isOwner,
  poolId,
  className,
}: LockedCommissionerFeatureProps) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    capturePostHog('paywall_viewed', {
      feature: paywallFeatureKey('commissioner'),
      pool_id: poolId ?? null,
    })
  }, [title, poolId, isOwner])

  async function handleUpgrade() {
    if (!poolId || busy) return
    setBusy(true)
    capturePostHog('upgrade_from_pool_prompt_clicked', {
      feature: paywallFeatureKey('commissioner'),
      pool_id: poolId,
    })
    const result = await startCustomPoolCheckout(poolId)
    if (!result.ok) {
      toast.error(result.error)
      setBusy(false)
      return
    }
    window.location.href = result.url
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-muted/20 px-4 py-4',
        className,
      )}
      role="group"
      aria-label={`${title} — Custom Pool feature, locked`}
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
            Custom Pool feature
            {description ? ` — ${description}` : null}
          </p>
          {isOwner ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Upgrade this pool — $9.99 one-time. No subscription.
              </p>
              {poolId ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn('h-9', FOCUS_VISIBLE_RING)}
                  disabled={busy}
                  onClick={() => void handleUpgrade()}
                >
                  {busy ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden
                      />
                      Starting checkout…
                    </>
                  ) : (
                    'Upgrade this pool — $9.99 one-time'
                  )}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Included with Custom Pool after you create this pool.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              These tools require the pool owner to upgrade to Custom Pool.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
