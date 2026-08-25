import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Idempotency helpers for the billing webhook (Custom Pool purchases).
 * Subscription sync helpers were removed in Phase 5.
 */

export async function claimStripeEvent(
  admin: SupabaseClient,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc('claim_stripe_event', {
    p_event_id: eventId,
    p_event_type: eventType,
  })
  if (error) {
    console.error('billing/webhook: claim_stripe_event failed', {
      eventId,
      eventType,
      error: error.message,
    })
    throw new Error(`claim_stripe_event: ${error.message}`)
  }
  return Boolean(data)
}

export async function finishStripeEvent(
  admin: SupabaseClient,
  eventId: string,
  status: 'processed' | 'failed' | 'skipped',
  errorMessage?: string | null,
): Promise<void> {
  const { error } = await admin.rpc('finish_stripe_event', {
    p_event_id: eventId,
    p_status: status,
    p_error: errorMessage ?? null,
  })
  if (error) {
    console.error('billing/webhook: finish_stripe_event failed', {
      eventId,
      status,
      error: error.message,
    })
  }
}
