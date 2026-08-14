'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProUpgradeModal } from '@/components/pro/pro-upgrade-modal'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'

export type LockedProFeatureProps = {
  title: string
  description?: string
  /** PostHog source for locked_viewed + modal events. */
  source: string
  ctaText?: string
  icon?: ReactNode
  /** Visual layout. `panel` = centered dashed card; `banner` = inline row. */
  variant?: 'panel' | 'banner'
  className?: string
  /** Optional preview / teaser above the lock copy (e.g. blurred bars). */
  children?: ReactNode
  /** Modal headline override. */
  modalHeadline?: string
}

/**
 * Generic Pro lock surface. CTA opens {@link ProUpgradeModal} (checkout),
 * mirroring LockedCommissionerFeature for Commissioner.
 */
export function LockedProFeature({
  title,
  description,
  source,
  ctaText = 'Upgrade to Pro',
  icon,
  variant = 'panel',
  className,
  children,
  modalHeadline,
}: LockedProFeatureProps) {
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    capturePostHog('pro_feature_locked_viewed', {
      source,
      feature: title,
    })
  }, [source, title])

  function openUpgrade() {
    capturePostHog('pro_feature_upgrade_prompt_clicked', {
      source,
      feature: title,
    })
    setModalOpen(true)
  }

  const bannerCta =
    ctaText === 'Upgrade to Pro' ? 'Upgrade' : ctaText

  return (
    <>
      <div
        className={cn(
          variant === 'panel' &&
            'rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center sm:px-8',
          variant === 'banner' &&
            'flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5',
          className,
        )}
        role="group"
        aria-label={`${title} — Pro feature, locked`}
      >
        {children}

        {variant === 'panel' ? (
          <>
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background/70 text-muted-foreground">
              {icon ?? <Lock className="h-5 w-5" aria-hidden />}
            </span>
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
            <Button
              type="button"
              className={cn('mt-5', FOCUS_VISIBLE_RING)}
              onClick={openUpgrade}
            >
              {ctaText}
            </Button>
          </>
        ) : (
          <>
            <span className="flex shrink-0 text-muted-foreground" aria-hidden>
              {icon ?? <Lock className="h-4 w-4" />}
            </span>
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {description ?? title}
            </p>
            <Button
              type="button"
              size="sm"
              className={cn('h-8 shrink-0', FOCUS_VISIBLE_RING)}
              onClick={openUpgrade}
            >
              {bannerCta}
            </Button>
          </>
        )}
      </div>

      <ProUpgradeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        source={source}
        headline={modalHeadline ?? title}
        description={description}
      />
    </>
  )
}
