'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { poolUpgradePath } from '@/src/lib/pool-settings-nav'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog, paywallFeatureKey } from '@/src/lib/posthog-client'

/** Dimmed preview opacity for locked Custom Pool features (40–60% band). */
export const LOCKED_FEATURE_PREVIEW_OPACITY_CLASS = 'opacity-50'

export type LockedFeatureSectionProps = {
  title: string
  /** Pool owner can upgrade; co-admins see owner-only copy. */
  isOwner: boolean
  poolId?: string
  inviteCode?: string
  /** Desktop embedded pool shell — instant nav to upgrade page. */
  onNavigateUpgrade?: () => void
  /**
   * Analytics feature key segment (e.g. exports, branding).
   * Defaults to commissioner paywall bucket.
   */
  feature?: string
  className?: string
  children?: ReactNode
}

/**
 * Shared locked Custom Pool pattern: real feature UI in a disabled preview,
 * compact lock + badge on the heading, quiet upgrade line underneath.
 */
export function LockedFeatureSection({
  title,
  isOwner,
  poolId,
  inviteCode,
  onNavigateUpgrade,
  feature = 'commissioner',
  className,
  children,
}: LockedFeatureSectionProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    capturePostHog('paywall_viewed', {
      feature: paywallFeatureKey(feature),
      pool_id: poolId ?? null,
    })
  }, [feature, poolId, title])

  function navigateToUpgrade() {
    if (busy) return
    setBusy(true)
    capturePostHog('upgrade_from_pool_prompt_clicked', {
      feature: paywallFeatureKey(feature),
      pool_id: poolId,
    })
    if (onNavigateUpgrade) {
      onNavigateUpgrade()
      setBusy(false)
      return
    }
    if (!inviteCode) {
      setBusy(false)
      return
    }
    router.push(poolUpgradePath(inviteCode))
    setBusy(false)
  }

  return (
    <section
      className={cn('min-w-0 space-y-3', className)}
      aria-label={`${title} — Custom Pool feature, locked`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold tracking-wide text-foreground">
          {title}
        </h4>
        <Badge
          variant="outline"
          className="gap-1 border-border/80 bg-muted/30 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <Lock className="h-3 w-3" aria-hidden />
          Custom Pool
        </Badge>
      </div>

      {children ? (
        <div
          className={cn(
            LOCKED_FEATURE_PREVIEW_OPACITY_CLASS,
            'pointer-events-none select-none',
          )}
          inert
          aria-disabled="true"
        >
          {children}
        </div>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-0.5">
        {isOwner ? (
          <>
            <p className="text-xs text-muted-foreground">
              Upgrade this pool to unlock this feature
            </p>
            {poolId || inviteCode ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => navigateToUpgrade()}
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60',
                  FOCUS_VISIBLE_RING,
                  'rounded-sm',
                )}
              >
                {busy ? (
                  <>
                    <Loader2
                      className="h-3 w-3 animate-spin"
                      aria-hidden
                    />
                    Opening…
                  </>
                ) : (
                  'Upgrade · $9.99 one-time'
                )}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Included with Custom Pool after you create this pool.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            These tools require the pool owner to upgrade to Custom Pool.
          </p>
        )}
      </div>
    </section>
  )
}

/** Legacy locked row — title + optional description preview (no rich children). */
export type LockedCommissionerFeatureProps = Omit<
  LockedFeatureSectionProps,
  'children'
> & {
  description?: string
}

export function LockedCommissionerFeature({
  description,
  ...props
}: LockedCommissionerFeatureProps) {
  return (
    <LockedFeatureSection {...props}>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </LockedFeatureSection>
  )
}
