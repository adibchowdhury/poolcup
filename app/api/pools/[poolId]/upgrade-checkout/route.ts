import { NextResponse } from 'next/server'
import { fetchIsPoolOwner } from '@/src/lib/pool-admin'
import { getOrCreateStripeCustomer } from '@/src/lib/stripe-customer'
import { getStripe, resolveCustomPoolPriceId } from '@/src/lib/stripe'
import { siteUrl } from '@/src/lib/site'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

/**
 * Owner-only one-time Custom Pool Checkout (mode: payment).
 * Does NOT flip pools.plan — billing webhook owns that.
 *
 * Ownership: `is_pool_owner` (creator / transferred owner). Co-commissioners
 * cannot purchase — strictest sensible gate for a paid entitlement flip.
 */
export async function POST(_request: Request, context: Ctx) {
  const { poolId } = await context.params
  if (!poolId) {
    return NextResponse.json({ error: 'poolId_required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const isOwner = await fetchIsPoolOwner(admin, poolId, user.id)
  if (!isOwner) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: pool, error: poolError } = await admin
    .from('pools')
    .select('id, plan, invite_code')
    .eq('id', poolId)
    .maybeSingle()

  if (poolError || !pool) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (pool.plan === 'custom') {
    return NextResponse.json(
      {
        error: 'already_custom',
        message: 'This pool is already a Custom Pool',
      },
      { status: 409 },
    )
  }

  if (pool.plan !== 'basic') {
    return NextResponse.json(
      { error: 'invalid_plan', message: 'Pool cannot be upgraded' },
      { status: 409 },
    )
  }

  let priceId: string
  try {
    priceId = resolveCustomPoolPriceId()
  } catch (err) {
    console.error('pools/upgrade-checkout: price env missing', err)
    return NextResponse.json(
      { error: 'billing_misconfigured' },
      { status: 500 },
    )
  }

  const inviteCode =
    typeof pool.invite_code === 'string' ? pool.invite_code.trim() : ''
  if (!inviteCode) {
    console.error('pools/upgrade-checkout: pool missing invite_code', {
      poolId,
    })
    return NextResponse.json({ error: 'pool_misconfigured' }, { status: 500 })
  }

  const settingsUrl = `${siteUrl}/pool/${encodeURIComponent(inviteCode)}/settings`
  const upgradeUrl = `${siteUrl}/pool/${encodeURIComponent(inviteCode)}/upgrade`

  try {
    const customerId = await getOrCreateStripeCustomer(user)
    const stripe = getStripe()

    const metadata = {
      pool_id: poolId,
      buyer_user_id: user.id,
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${settingsUrl}?upgraded=1`,
      cancel_url: upgradeUrl,
      metadata,
    })

    if (!session.url) {
      console.error('pools/upgrade-checkout: session missing url', {
        sessionId: session.id,
        poolId,
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'checkout_failed' },
        { status: 500 },
      )
    }

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err) {
    console.error('pools/upgrade-checkout: Stripe error', {
      poolId,
      userId: user.id,
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
