'use client'

import { capturePostHog } from '@/src/lib/posthog-client'

export type StartCustomPoolCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status?: number }

/**
 * POST /api/pools/[poolId]/upgrade-checkout → Stripe Checkout URL.
 * Caller should redirect (window.location) on success.
 */
export async function startCustomPoolCheckout(
  poolId: string,
): Promise<StartCustomPoolCheckoutResult> {
  const res = await fetch(`/api/pools/${encodeURIComponent(poolId)}/upgrade-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  const data = (await res.json().catch(() => null)) as {
    url?: string
    error?: string
    message?: string
  } | null

  if (res.status === 401) {
    return { ok: false, error: 'Sign in to upgrade this pool', status: 401 }
  }

  if (res.status === 409) {
    return {
      ok: false,
      error: data?.message || 'This pool is already a Custom Pool',
      status: 409,
    }
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

  capturePostHog('custom_pool_checkout_started', { pool_id: poolId })
  return { ok: true, url: data.url }
}
