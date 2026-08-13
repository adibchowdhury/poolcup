import 'server-only'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripe, type BillingPlan } from '@/src/lib/stripe'

export type UserTier = 'free' | BillingPlan

export type SubscriptionStatusForSync =
  | Stripe.Subscription.Status
  | 'canceled'
  | string

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value))
}

/**
 * Map Stripe price IDs → PoolCup tiers.
 * Unknown prices log + return null (caller decides safe fallback).
 */
export function priceIdToTier(priceId: string | null | undefined): UserTier | null {
  if (!priceId) return null
  const pro = process.env.STRIPE_PRICE_PRO?.trim()
  const commissioner = process.env.STRIPE_PRICE_COMMISSIONER?.trim()
  if (pro && priceId === pro) return 'pro'
  if (commissioner && priceId === commissioner) return 'commissioner'
  console.warn('billing/webhook: unknown Stripe price id', { priceId })
  return null
}

export function subscriptionPrimaryPriceId(
  subscription: Stripe.Subscription,
): string | null {
  const item = subscription.items?.data?.[0]
  const price = item?.price
  if (!price) return null
  return typeof price === 'string' ? price : price.id
}

/**
 * In API 2026-05-27.dahlia, current_period_end lives on subscription items.
 */
export function subscriptionPeriodEndIso(
  subscription: Stripe.Subscription,
): string | null {
  const end = subscription.items?.data?.[0]?.current_period_end
  if (typeof end !== 'number' || !Number.isFinite(end)) return null
  return new Date(end * 1000).toISOString()
}

export function customerIdFrom(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if ('deleted' in value && value.deleted) return value.id
  return value.id
}

export function subscriptionIdFrom(
  value: string | Stripe.Subscription | null | undefined,
): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

/**
 * Grace-period policy (money-critical):
 * - past_due: keep paid tier; UI can warn via subscription_status.
 *   If price is unmappable, `tier` is null — callers MUST preserve the
 *   user's existing DB tier (never write 'free' on payment failure).
 * - unpaid / canceled / incomplete_expired: drop to free.
 * - active / trialing: tier from current price.
 * Tier also drops on customer.subscription.deleted.
 */
export function tierAndStatusFromSubscription(subscription: Stripe.Subscription): {
  /** Null only for past_due + unknown price — preserve existing DB tier. */
  tier: UserTier | null
  status: string
} {
  const status = subscription.status
  const priceTier = priceIdToTier(subscriptionPrimaryPriceId(subscription))

  if (status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid') {
    return { tier: 'free', status }
  }

  if (status === 'past_due') {
    // Grace: map from price when known; null → caller keeps existing tier.
    return { tier: priceTier, status }
  }

  if (status === 'active' || status === 'trialing') {
    return { tier: priceTier ?? 'free', status }
  }

  // incomplete, paused, etc. — do not grant paid access.
  return { tier: priceTier && status === 'incomplete' ? 'free' : priceTier ?? 'free', status }
}

/** Read the user's current billing tier from DB (defaults to free). */
export async function loadExistingUserTier(
  admin: SupabaseClient,
  userId: string,
): Promise<UserTier> {
  const { data } = await admin
    .from('users')
    .select('tier')
    .eq('id', userId)
    .maybeSingle()
  if (data?.tier === 'pro' || data?.tier === 'commissioner') {
    return data.tier
  }
  return 'free'
}

/**
 * Resolve tier for sync: use mapped tier when present; on null (past_due
 * grace with unknown price) reuse the user's existing DB tier.
 */
export async function resolveTierForSync(
  admin: SupabaseClient,
  userId: string,
  tier: UserTier | null,
): Promise<UserTier> {
  if (tier != null) return tier
  return loadExistingUserTier(admin, userId)
}

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

/**
 * Terminal: event can never map to a PoolCup user (orphan / test noise).
 * Route must acknowledge with HTTP 200 + finish_stripe_event('skipped') —
 * do NOT return 500 (Stripe would retry forever).
 */
export class UnresolvableBillingUserError extends Error {
  readonly terminal = true as const

  constructor(message: string) {
    super(message)
    this.name = 'UnresolvableBillingUserError'
  }
}

export async function syncUserSubscription(
  admin: SupabaseClient,
  params: {
    userId: string
    tier: UserTier
    status: string
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    currentPeriodEnd: string | null
  },
): Promise<void> {
  const { error } = await admin.rpc('sync_user_subscription', {
    p_user_id: params.userId,
    p_tier: params.tier,
    p_status: params.status,
    p_stripe_customer_id: params.stripeCustomerId,
    p_stripe_subscription_id: params.stripeSubscriptionId,
    p_current_period_end: params.currentPeriodEnd,
  })
  if (error) {
    console.error('billing/webhook: sync_user_subscription failed', {
      userId: params.userId,
      tier: params.tier,
      status: params.status,
      error: error.message,
    })
    throw new Error(`sync_user_subscription: ${error.message}`)
  }
}

export async function resolvePoolcupUserId(
  admin: SupabaseClient,
  opts: {
    metadataUserId?: string | null
    clientReferenceId?: string | null
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
  },
): Promise<string | null> {
  const fromMeta = opts.metadataUserId?.trim()
  if (isUuid(fromMeta)) return fromMeta

  const fromRef = opts.clientReferenceId?.trim()
  if (isUuid(fromRef)) return fromRef

  if (opts.stripeSubscriptionId) {
    const { data } = await admin
      .from('users')
      .select('id')
      .eq('stripe_subscription_id', opts.stripeSubscriptionId)
      .maybeSingle()
    if (data?.id && isUuid(data.id)) return data.id
  }

  if (opts.stripeCustomerId) {
    const { data } = await admin
      .from('users')
      .select('id')
      .eq('stripe_customer_id', opts.stripeCustomerId)
      .maybeSingle()
    if (data?.id && isUuid(data.id)) return data.id
  }

  return null
}

export async function retrieveSubscription(
  subscriptionRef: string | Stripe.Subscription,
): Promise<Stripe.Subscription> {
  if (typeof subscriptionRef !== 'string') return subscriptionRef
  return getStripe().subscriptions.retrieve(subscriptionRef)
}
