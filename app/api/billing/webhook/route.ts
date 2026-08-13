import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/src/lib/stripe'
import {
  claimStripeEvent,
  customerIdFrom,
  finishStripeEvent,
  priceIdToTier,
  loadExistingUserTier,
  resolvePoolcupUserId,
  resolveTierForSync,
  retrieveSubscription,
  subscriptionIdFrom,
  subscriptionPeriodEndIso,
  subscriptionPrimaryPriceId,
  syncUserSubscription,
  tierAndStatusFromSubscription,
  UnresolvableBillingUserError,
} from '@/src/lib/stripe-billing-webhook'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Stripe SUBSCRIPTION webhook (separate from donation `/api/stripe-webhook`).
 *
 * Auth = Stripe signature verification with STRIPE_BILLING_WEBHOOK_SECRET.
 * Entitlements are set ONLY via sync_user_subscription from verified events.
 *
 * Grace period: past_due keeps paid tier; free only on deleted / canceled /
 * unpaid / incomplete_expired (see tierAndStatusFromSubscription).
 *
 * Error classes:
 * - Unresolvable user (terminal) → finish 'skipped' + HTTP 200 (no Stripe retry)
 * - Transient / unexpected → finish 'failed' + HTTP 500 (Stripe retries)
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    console.error(
      'billing/webhook: STRIPE_BILLING_WEBHOOK_SECRET is not configured',
    )
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature' },
      { status: 400 },
    )
  }

  let event: Stripe.Event
  try {
    // Raw body required for signature verification (do not JSON.parse first).
    const rawBody = await request.text()
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    )
  } catch (error) {
    console.error('billing/webhook: signature verification failed', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()

  let claimed = false
  try {
    claimed = await claimStripeEvent(admin, event.id, event.type)
  } catch (error) {
    console.error('billing/webhook: claim failed', {
      eventId: event.id,
      type: event.type,
      error,
    })
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }

  if (!claimed) {
    // Idempotent skip — already processed or in-flight.
    return NextResponse.json({ received: true, skipped: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          admin,
          event.data.object as Stripe.Checkout.Session,
        )
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          admin,
          event.data.object as Stripe.Subscription,
        )
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          admin,
          event.data.object as Stripe.Subscription,
        )
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(
          admin,
          event.data.object as Stripe.Invoice,
        )
        break
      default:
        console.log('billing/webhook: unhandled event type', event.type)
        break
    }

    await finishStripeEvent(admin, event.id, 'processed')
    return NextResponse.json({ received: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Webhook handler failed'

    // Terminal: no PoolCup user will ever match — acknowledge, do not retry.
    if (error instanceof UnresolvableBillingUserError) {
      console.warn('billing/webhook: could not resolve user, skipping', {
        eventId: event.id,
        type: event.type,
        error: message,
      })
      await finishStripeEvent(admin, event.id, 'skipped', message)
      return NextResponse.json({ received: true, skipped: true })
    }

    console.error('billing/webhook: handler error', {
      eventId: event.id,
      type: event.type,
      error: message,
    })
    await finishStripeEvent(admin, event.id, 'failed', message)
    // 500 so Stripe retries transient failures.
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutSessionCompleted(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== 'subscription') {
    // Ignore one-time / donate sessions on this endpoint if misrouted.
    console.log('billing/webhook: ignoring non-subscription checkout session', {
      sessionId: session.id,
      mode: session.mode,
    })
    return
  }

  const customerId = customerIdFrom(session.customer)
  const subscriptionRef = session.subscription
  if (!subscriptionRef) {
    throw new Error('checkout.session.completed missing subscription')
  }

  const userId = await resolvePoolcupUserId(admin, {
    metadataUserId: session.metadata?.poolcup_user_id,
    clientReferenceId: session.client_reference_id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionIdFrom(subscriptionRef),
  })

  if (!userId) {
    throw new UnresolvableBillingUserError(
      `checkout.session.completed: could not resolve PoolCup user (session ${session.id})`,
    )
  }

  const subscription = await retrieveSubscription(subscriptionRef)
  const { tier, status } = tierAndStatusFromSubscription(subscription)

  await syncUserSubscription(admin, {
    userId,
    tier: await resolveTierForSync(admin, userId, tier),
    status,
    stripeCustomerId: customerIdFrom(subscription.customer) ?? customerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: subscriptionPeriodEndIso(subscription),
  })
}

async function handleSubscriptionUpdated(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = customerIdFrom(subscription.customer)
  const userId = await resolvePoolcupUserId(admin, {
    metadataUserId: subscription.metadata?.poolcup_user_id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
  })

  if (!userId) {
    throw new UnresolvableBillingUserError(
      `customer.subscription.updated: could not resolve user (sub ${subscription.id})`,
    )
  }

  const { tier, status } = tierAndStatusFromSubscription(subscription)

  await syncUserSubscription(admin, {
    userId,
    tier: await resolveTierForSync(admin, userId, tier),
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: subscriptionPeriodEndIso(subscription),
  })
}

async function handleSubscriptionDeleted(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = customerIdFrom(subscription.customer)
  const userId = await resolvePoolcupUserId(admin, {
    metadataUserId: subscription.metadata?.poolcup_user_id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
  })

  if (!userId) {
    throw new UnresolvableBillingUserError(
      `customer.subscription.deleted: could not resolve user (sub ${subscription.id})`,
    )
  }

  await syncUserSubscription(admin, {
    userId,
    tier: 'free',
    status: 'canceled',
    stripeCustomerId: customerId,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
  })
}

async function handleInvoicePaymentFailed(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  invoice: Stripe.Invoice,
): Promise<void> {
  /**
   * Grace period: mark past_due but keep the paid tier from the subscription
   * price. Tier is only stripped on terminal cancel/unpaid/deleted.
   */
  const customerId = customerIdFrom(invoice.customer)
  const subscriptionRef =
    // Newer Stripe invoice types nest subscription under parent.subscription_details
    // or expose it as a top-level field depending on API version.
    (invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null
    }).subscription ??
    (
      invoice as Stripe.Invoice & {
        parent?: {
          subscription_details?: {
            subscription?: string | Stripe.Subscription | null
          } | null
        } | null
      }
    ).parent?.subscription_details?.subscription ??
    null

  if (!subscriptionRef && !customerId) {
    throw new Error('invoice.payment_failed: missing customer and subscription')
  }

  let subscription: Stripe.Subscription | null = null
  if (subscriptionRef) {
    subscription = await retrieveSubscription(subscriptionRef)
  }

  const userId = await resolvePoolcupUserId(admin, {
    metadataUserId: subscription?.metadata?.poolcup_user_id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription?.id ?? null,
  })

  if (!userId) {
    throw new UnresolvableBillingUserError(
      `invoice.payment_failed: could not resolve user (invoice ${invoice.id})`,
    )
  }

  if (subscription) {
    const priceTier = priceIdToTier(subscriptionPrimaryPriceId(subscription))
    // Grace: never downgrade on payment failure — keep existing tier if price unmapped.
    await syncUserSubscription(admin, {
      userId,
      tier: await resolveTierForSync(admin, userId, priceTier),
      status: 'past_due',
      stripeCustomerId: customerIdFrom(subscription.customer) ?? customerId,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: subscriptionPeriodEndIso(subscription),
    })
    return
  }

  // No subscription on the invoice: keep existing tier, mark past_due only.
  const { data: existing } = await admin
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle()

  await syncUserSubscription(admin, {
    userId,
    tier: await loadExistingUserTier(admin, userId),
    status: 'past_due',
    stripeCustomerId: customerId,
    stripeSubscriptionId:
      typeof existing?.stripe_subscription_id === 'string'
        ? existing.stripe_subscription_id
        : null,
    currentPeriodEnd: null,
  })
}
