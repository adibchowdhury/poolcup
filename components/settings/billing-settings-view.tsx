'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  startBillingCheckout,
  startBillingPortal,
  type BillingPlan,
} from '@/src/lib/billing-checkout-client'
import type { BillingSnapshot, BillingTier } from '@/src/lib/billing-types'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'

const PLAN_LABEL: Record<BillingTier, string> = {
  free: 'Free',
  pro: 'Pro',
  commissioner: 'Commissioner',
}

type BillingSettingsViewProps = {
  initial: BillingSnapshot
  checkoutStatus?: string | null
}

type RetryAction =
  | { kind: 'load' }
  | { kind: 'checkout'; plan: BillingPlan }
  | { kind: 'portal' }

function formatPeriodDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(d)
}

export function BillingSettingsView({
  initial,
  checkoutStatus = null,
}: BillingSettingsViewProps) {
  const router = useRouter()
  const [billing, setBilling] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState<BillingPlan | null>(null)
  const [portalBusy, setPortalBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setRetryAction(null)
    try {
      const res = await fetch('/api/billing/me')
      if (res.status === 401) {
        router.push('/login?next=/settings/billing')
        return
      }
      if (!res.ok) {
        throw new Error('Could not load billing')
      }
      const data = (await res.json()) as { billing?: BillingSnapshot }
      if (!data.billing) throw new Error('Could not load billing')
      setBilling(data.billing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load billing')
      setRetryAction({ kind: 'load' })
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    capturePostHog('billing_page_viewed', { tier: initial.tier })
  }, [initial.tier])

  useEffect(() => {
    if (checkoutStatus === 'success') {
      setBanner("You're all set! Plan active.")
      if (billing.tier === 'free') {
        setFinalizing(true)
        const t = window.setTimeout(() => {
          void (async () => {
            await load()
            setFinalizing(false)
          })()
        }, 1500)
        return () => window.clearTimeout(t)
      }
    } else if (checkoutStatus === 'cancel') {
      setBanner('Checkout canceled.')
    }
    return undefined
  }, [checkoutStatus, billing.tier, load])

  async function handleUpgrade(plan: BillingPlan) {
    if (checkoutBusy || portalBusy) return
    setCheckoutBusy(plan)
    setError(null)
    setRetryAction(null)
    capturePostHog('upgrade_clicked', { plan })
    const result = await startBillingCheckout(plan)
    setCheckoutBusy(null)
    if (!result.ok) {
      if (result.status === 401) {
        router.push('/login?next=/settings/billing')
        return
      }
      setError(result.error)
      setRetryAction({ kind: 'checkout', plan })
      toast.error(result.error)
      return
    }
    window.location.assign(result.url)
  }

  async function handleManageBilling() {
    if (checkoutBusy || portalBusy) return
    setPortalBusy(true)
    setError(null)
    setRetryAction(null)
    capturePostHog('manage_billing_clicked', { tier: billing.tier })
    const result = await startBillingPortal()
    setPortalBusy(false)
    if (!result.ok) {
      if (result.status === 401) {
        router.push('/login?next=/settings/billing')
        return
      }
      setError(result.error)
      setRetryAction({ kind: 'portal' })
      toast.error(result.error)
      return
    }
    window.location.assign(result.url)
  }

  function handleRetry() {
    if (!retryAction) return
    if (retryAction.kind === 'load') {
      void load()
      return
    }
    if (retryAction.kind === 'checkout') {
      void handleUpgrade(retryAction.plan)
      return
    }
    void handleManageBilling()
  }

  const isPaid = billing.tier === 'pro' || billing.tier === 'commissioner'
  const isPastDue = billing.subscriptionStatus === 'past_due'
  const periodLabel = formatPeriodDate(billing.currentPeriodEnd)
  const accessEnding =
    billing.subscriptionStatus === 'canceled' ||
    billing.subscriptionStatus === 'past_due'

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/dashboard"
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground',
            FOCUS_VISIBLE_RING,
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div>
          <h1 className="font-display text-3xl tracking-wide text-foreground">
            Billing
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your PoolCup plan and payment method.
          </p>
        </div>
      </div>

      {banner ? (
        <p
          className="mb-4 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-foreground"
          role="status"
        >
          {banner}
          {finalizing ? ' Finalizing…' : null}
        </p>
      ) : null}

      {isPastDue ? (
        <div
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100"
          role="alert"
        >
          <p className="font-medium">Your last payment failed</p>
          <p className="mt-1 text-amber-100/80">
            Update your payment method to keep your plan.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn('mt-3 h-8 border-amber-500/40', FOCUS_VISIBLE_RING)}
            disabled={portalBusy}
            onClick={() => void handleManageBilling()}
          >
            {portalBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" aria-hidden />
            )}
            Update payment method
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-busy
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading plan…
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 space-y-2" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={cn('h-8', FOCUS_VISIBLE_RING)}
            disabled={loading || portalBusy || Boolean(checkoutBusy)}
            onClick={() => handleRetry()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      <section
        className="rounded-xl border border-border bg-card/40 p-4 sm:p-5"
        aria-labelledby="current-plan-heading"
      >
        <h2
          id="current-plan-heading"
          className="font-display text-xl tracking-wide text-foreground"
        >
          Current plan
        </h2>
        <p className="mt-2 text-2xl font-semibold text-primary">
          {PLAN_LABEL[billing.tier]}
        </p>
        <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
          <div>
            <dt className="inline font-medium text-foreground">Status: </dt>
            <dd className="inline capitalize">
              {billing.subscriptionStatus?.replace(/_/g, ' ') ||
                (isPaid ? 'active' : '—')}
            </dd>
          </div>
          {periodLabel ? (
            <div>
              <dt className="inline font-medium text-foreground">
                {accessEnding ? 'Access ends on: ' : 'Renews on: '}
              </dt>
              <dd className="inline">{periodLabel}</dd>
            </div>
          ) : null}
        </dl>

        {isPaid ? (
          <Button
            type="button"
            className={cn('mt-4 w-full sm:w-auto', FOCUS_VISIBLE_RING)}
            disabled={portalBusy || Boolean(checkoutBusy)}
            onClick={() => void handleManageBilling()}
          >
            {portalBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" aria-hidden />
            )}
            Manage billing
          </Button>
        ) : null}
      </section>

      {!isPaid ? (
        <section className="mt-6 space-y-3" aria-labelledby="upgrade-heading">
          <h2
            id="upgrade-heading"
            className="font-display text-xl tracking-wide text-foreground"
          >
            Upgrade
          </h2>
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">PoolCup Pro</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Insights and personalization — coming soon.
                </p>
              </div>
              <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Coming soon
              </p>
            </div>
          </div>
          <UpgradeCard
            title="Pool Commissioner"
            price="$9.99/mo"
            description="Admin tools, branding, exports, and more."
            plan="commissioner"
            busy={checkoutBusy}
            onUpgrade={handleUpgrade}
            premium
          />
        </section>
      ) : (
        <section className="mt-6 space-y-3" aria-labelledby="switch-heading">
          <h2
            id="switch-heading"
            className="font-display text-xl tracking-wide text-foreground"
          >
            Change plan
          </h2>
          <p className="text-sm text-muted-foreground">
            Switch plans or cancel in the Stripe billing portal.
          </p>
          {billing.tier !== 'commissioner' ? (
            <p className="text-sm text-muted-foreground">
              Want Commissioner? Open Manage billing to upgrade.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            PoolCup Pro is coming soon.
          </p>
        </section>
      )}
    </main>
  )
}

function UpgradeCard({
  title,
  price,
  description,
  plan,
  busy,
  onUpgrade,
  premium,
}: {
  title: string
  price: string
  description: string
  plan: BillingPlan
  busy: BillingPlan | null
  onUpgrade: (plan: BillingPlan) => void
  premium?: boolean
}) {
  const isBusy = busy === plan
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        premium
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-primary/25 bg-primary/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="shrink-0 font-display text-xl text-foreground">{price}</p>
      </div>
      <Button
        type="button"
        size="sm"
        className={cn('mt-3 h-9', FOCUS_VISIBLE_RING)}
        disabled={Boolean(busy)}
        aria-busy={isBusy}
        onClick={() => onUpgrade(plan)}
      >
        {isBusy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
        )}
        {isBusy ? 'Redirecting…' : `Upgrade to ${plan === 'pro' ? 'Pro' : 'Commissioner'}`}
      </Button>
    </div>
  )
}
