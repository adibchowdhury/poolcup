'use client'

import { capturePostHog } from '@/src/lib/posthog-client'
import type { PoolCreationDraftPayload } from '@/src/lib/create-wizard-persistence'

export type StartDraftCustomPoolCheckoutResult =
  | { ok: true; url: string; draftId: string }
  | { ok: false; error: string; status?: number }

/**
 * POST /api/pool-drafts/checkout → Stripe Checkout URL (no pool yet).
 */
export async function startDraftCustomPoolCheckout(
  payload: PoolCreationDraftPayload,
): Promise<StartDraftCustomPoolCheckoutResult> {
  const res = await fetch('/api/pool-drafts/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  })

  const data = (await res.json().catch(() => null)) as {
    url?: string
    draftId?: string
    error?: string
    message?: string
    field?: string
  } | null

  if (res.status === 401) {
    return { ok: false, error: 'Sign in to continue', status: 401 }
  }

  if (!res.ok || !data?.url || !data.draftId) {
    return {
      ok: false,
      error:
        data?.message ||
        data?.error ||
        'Could not start checkout. Please try again.',
      status: res.status,
    }
  }

  capturePostHog('custom_pool_checkout_started', {
    draft_id: data.draftId,
    source: 'create_wizard',
  })
  return { ok: true, url: data.url, draftId: data.draftId }
}
