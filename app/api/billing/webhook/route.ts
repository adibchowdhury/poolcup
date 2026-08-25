import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, resolveCustomPoolPriceId } from '@/src/lib/stripe'
import {
  claimStripeEvent,
  finishStripeEvent,
} from '@/src/lib/stripe-billing-webhook'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

function paymentIntentIdFrom(
  paymentIntent: string | Stripe.PaymentIntent | null | undefined,
): string | null {
  if (!paymentIntent) return null
  if (typeof paymentIntent === 'string') return paymentIntent
  return paymentIntent.id ?? null
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Stripe BILLING webhook — Custom Pool one-time purchases only.
 * Separate from donation `/api/stripe-webhook`.
 *
 * Auth = Stripe signature verification with STRIPE_BILLING_WEBHOOK_SECRET.
 * Handled events: checkout.session.completed (mode=payment + pool_id metadata).
 * Idempotency: claim_stripe_event / finish_stripe_event.
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
      default:
        console.log('billing/webhook: unhandled event type', event.type)
        break
    }

    await finishStripeEvent(admin, event.id, 'processed')
    return NextResponse.json({ received: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Webhook handler failed'

    console.error('billing/webhook: handler error', {
      eventId: event.id,
      type: event.type,
      error: message,
    })
    await finishStripeEvent(admin, event.id, 'failed', message)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutSessionCompleted(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const poolId = session.metadata?.pool_id?.trim()
  if (session.mode === 'payment' && poolId) {
    await handleCustomPoolCheckoutCompleted(admin, session, poolId)
    return
  }

  // Ignore subscription / donate / unknown sessions on this endpoint.
  console.log('billing/webhook: ignoring non-custom-pool checkout session', {
    sessionId: session.id,
    mode: session.mode,
    hasPoolId: Boolean(poolId),
  })
}

/**
 * One-time Custom Pool purchase: ledger insert + pools.plan = 'custom'.
 * If the pool was deleted before delivery: log and ack (no throw / no retry).
 */
async function handleCustomPoolCheckoutCompleted(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  session: Stripe.Checkout.Session,
  poolId: string,
): Promise<void> {
  if (session.payment_status !== 'paid') {
    console.warn('billing/webhook: custom pool session not paid — skipping', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      poolId,
    })
    return
  }

  const buyerUserId = session.metadata?.buyer_user_id?.trim()
  if (!buyerUserId) {
    throw new Error(
      `custom pool checkout missing buyer_user_id (session ${session.id})`,
    )
  }

  let expectedAmount: number
  let expectedCurrency: string
  try {
    const priceId = resolveCustomPoolPriceId()
    const price = await getStripe().prices.retrieve(priceId)
    if (typeof price.unit_amount !== 'number') {
      throw new Error('STRIPE_PRICE_CUSTOM_POOL has no unit_amount')
    }
    expectedAmount = price.unit_amount
    expectedCurrency = (price.currency || 'usd').toLowerCase()
  } catch (err) {
    throw new Error(
      `custom pool price lookup failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const amountTotal = session.amount_total
  const currency = (session.currency || '').toLowerCase()
  if (
    amountTotal == null ||
    amountTotal !== expectedAmount ||
    currency !== expectedCurrency
  ) {
    throw new Error(
      `custom pool amount mismatch (session ${session.id}): got ${amountTotal} ${currency}, expected ${expectedAmount} ${expectedCurrency}`,
    )
  }

  const { data: pool, error: poolError } = await admin
    .from('pools')
    .select('id, plan')
    .eq('id', poolId)
    .maybeSingle()

  if (poolError) {
    throw new Error(`custom pool load failed: ${poolError.message}`)
  }

  if (!pool) {
    console.warn(
      'billing/webhook: custom pool purchase for deleted pool — acknowledging',
      { sessionId: session.id, poolId, buyerUserId },
    )
    return
  }

  const { error: insertError } = await admin.from('pool_plan_purchases').insert({
    pool_id: poolId,
    buyer_user_id: buyerUserId,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentIdFrom(session.payment_intent),
    amount_cents: amountTotal,
    currency,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      console.log('billing/webhook: custom pool purchase already recorded', {
        sessionId: session.id,
        poolId,
        message: insertError.message,
      })
    } else if (
      insertError.code === '23503' ||
      /foreign key|violates foreign key/i.test(insertError.message)
    ) {
      console.warn(
        'billing/webhook: custom pool FK miss (pool deleted mid-flight) — acknowledging',
        { sessionId: session.id, poolId, message: insertError.message },
      )
      return
    } else {
      throw new Error(`pool_plan_purchases insert: ${insertError.message}`)
    }
  }

  const { data: updated, error: updateError } = await admin
    .from('pools')
    .update({ plan: 'custom' })
    .eq('id', poolId)
    .select('id')
    .maybeSingle()

  if (updateError) {
    throw new Error(`pools.plan update failed: ${updateError.message}`)
  }

  if (!updated) {
    console.warn(
      'billing/webhook: custom pool plan update matched 0 rows (deleted?) — acknowledging',
      { sessionId: session.id, poolId },
    )
  }
}
