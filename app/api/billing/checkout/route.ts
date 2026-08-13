import { NextResponse } from 'next/server'
import {
  getStripe,
  isBillingPlan,
  resolveBillingPriceId,
  type BillingPlan,
} from '@/src/lib/stripe'
import { getOrCreateStripeCustomer } from '@/src/lib/stripe-customer'
import { siteUrl } from '@/src/lib/site'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckoutBody = {
  plan?: unknown
}

/**
 * Authenticated subscription Checkout. Creates a Stripe session only —
 * does NOT set users.tier / entitlements (webhook owns that).
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: CheckoutBody
  try {
    body = (await request.json()) as CheckoutBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!isBillingPlan(body.plan)) {
    return NextResponse.json(
      { error: 'invalid_plan', message: 'plan must be pro or commissioner' },
      { status: 400 },
    )
  }

  const plan: BillingPlan = body.plan

  let priceId: string
  try {
    priceId = resolveBillingPriceId(plan)
  } catch (err) {
    console.error('billing/checkout: price env missing', err)
    return NextResponse.json(
      { error: 'billing_misconfigured' },
      { status: 500 },
    )
  }

  try {
    const customerId = await getOrCreateStripeCustomer(user)
    const stripe = getStripe()

    const metadata = {
      poolcup_user_id: user.id,
      plan,
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/settings/billing?status=success`,
      cancel_url: `${siteUrl}/settings/billing?status=cancel`,
      metadata,
      subscription_data: {
        metadata,
      },
    })

    if (!session.url) {
      console.error('billing/checkout: session missing url', {
        sessionId: session.id,
        userId: user.id,
        plan,
      })
      return NextResponse.json(
        { error: 'checkout_failed' },
        { status: 500 },
      )
    }

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err) {
    console.error('billing/checkout: Stripe error', {
      userId: user.id,
      plan,
      error: err instanceof Error ? err.message : err,
    })
    return NextResponse.json(
      {
        error: 'checkout_failed',
        message: 'Could not start checkout. Please try again.',
      },
      { status: 502 },
    )
  }
}
