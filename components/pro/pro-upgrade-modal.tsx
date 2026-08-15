'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { startBillingCheckout } from '@/src/lib/billing-checkout-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog, paywallFeatureKey } from '@/src/lib/posthog-client'

const DEFAULT_BENEFITS = [
  'Advanced analytics & form trends',
  'Historical performance & history filters',
  'Premium accent themes',
  'Crowd Win Chance before kickoff',
] as const

export type ProUpgradeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** PostHog `source` for open / checkout events. */
  source: string
  /** Optional feature-specific headline (defaults to PoolCup Pro). */
  headline?: string
  description?: string
  className?: string
}

/**
 * Shared Pro upgrade dialog. Primary CTA starts Stripe checkout for plan=pro.
 * Focus-trapped via Radix Dialog; keyboard Esc/Tab supported.
 */
export function ProUpgradeModal({
  open,
  onOpenChange,
  source,
  headline = 'Unlock PoolCup Pro',
  description = 'Get player insights and personalization — analytics, themes, history filters, and Crowd Win Chance before kickoff.',
  className,
}: ProUpgradeModalProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setBusy(false)
      setError(null)
      return
    }
    capturePostHog('paywall_viewed', {
      feature: paywallFeatureKey(source),
    })
  }, [open, source])

  async function handleCheckout() {
    if (busy) return
    setBusy(true)
    setError(null)
    capturePostHog('pro_upgrade_modal_checkout_clicked', {
      source,
      plan: 'pro',
    })
    const result = await startBillingCheckout('pro')
    if (!result.ok) {
      setBusy(false)
      if (result.status === 401) {
        onOpenChange(false)
        router.push('/login?next=/settings/billing')
        return
      }
      setError(result.error)
      return
    }
    window.location.assign(result.url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-md', className)}>
        <DialogHeader>
          <div className="mb-1 flex items-center justify-center sm:justify-start">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary"
              aria-hidden
            >
              <Sparkles className="h-5 w-5" />
            </span>
          </div>
          <DialogTitle className="font-display text-2xl tracking-wide">
            {headline}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-foreground">
          {DEFAULT_BENEFITS.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">$4.99/mo</span>
          {' · '}
          Cancel anytime from Billing.
        </p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className={FOCUS_VISIBLE_RING}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
          <Button
            type="button"
            className={FOCUS_VISIBLE_RING}
            disabled={busy}
            onClick={() => void handleCheckout()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Starting checkout…
              </>
            ) : (
              'Upgrade to Pro'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
