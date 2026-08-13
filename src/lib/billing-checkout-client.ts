'use client'

import { capturePostHog } from '@/src/lib/posthog-client'

export type BillingPlan = 'pro' | 'commissioner'

export type StartCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status?: number }

/**
 * POST /api/billing/checkout and return the Stripe Checkout URL.
 * Caller should redirect (window.location) on success.
 */
export async function startBillingCheckout(
  plan: BillingPlan,
): Promise<StartCheckoutResult> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })

  const data = (await res.json().catch(() => null)) as {
    url?: string
    error?: string
    message?: string
  } | null

  if (res.status === 401) {
    return { ok: false, error: 'Sign in to upgrade', status: 401 }
  }

  if (!res.ok || !data?.url) {
    return {
      ok: false,
      error:
        data?.message ||
        data?.error ||
        'Could not start checkout. Please try again.',
      status: res.status,
    }
  }

  capturePostHog('checkout_started', { plan })
  return { ok: true, url: data.url }
}

export type StartPortalResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status?: number }

/** POST /api/billing/portal — Customer Portal for the authed user only. */
export async function startBillingPortal(): Promise<StartPortalResult> {
  const res = await fetch('/api/billing/portal', { method: 'POST' })
  const data = (await res.json().catch(() => null)) as {
    url?: string
    error?: string
    message?: string
  } | null

  if (res.status === 401) {
    return { ok: false, error: 'Sign in to manage billing', status: 401 }
  }

  if (!res.ok || !data?.url) {
    return {
      ok: false,
      error:
        data?.message ||
        data?.error ||
        'Could not open billing portal. Please try again.',
      status: res.status,
    }
  }

  return { ok: true, url: data.url }
}
