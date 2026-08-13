import 'server-only'
import type { BillingSnapshot, BillingTier } from '@/src/lib/billing-types'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export type { BillingSnapshot, BillingTier } from '@/src/lib/billing-types'

export async function loadUserBillingSnapshot(
  userId: string,
): Promise<BillingSnapshot | null> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('users')
    .select(
      'tier, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_current_period_end',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('loadUserBillingSnapshot failed', {
      userId,
      error: error.message,
    })
    return null
  }
  if (!data) return null

  const rawTier = typeof data.tier === 'string' ? data.tier.trim() : 'free'
  const tier: BillingTier =
    rawTier === 'pro' || rawTier === 'commissioner' ? rawTier : 'free'

  return {
    tier,
    subscriptionStatus:
      typeof data.subscription_status === 'string'
        ? data.subscription_status
        : null,
    stripeCustomerId:
      typeof data.stripe_customer_id === 'string'
        ? data.stripe_customer_id
        : null,
    stripeSubscriptionId:
      typeof data.stripe_subscription_id === 'string'
        ? data.stripe_subscription_id
        : null,
    currentPeriodEnd:
      data.subscription_current_period_end != null
        ? String(data.subscription_current_period_end)
        : null,
  }
}
