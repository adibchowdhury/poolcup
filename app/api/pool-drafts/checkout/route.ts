import { NextResponse } from 'next/server'
import { validatePoolCreationDraftPayload } from '@/src/lib/pool-creation-draft'
import { getOrCreateStripeCustomer } from '@/src/lib/stripe-customer'
import { getStripe, resolveCustomPoolPriceId } from '@/src/lib/stripe'
import { siteUrl } from '@/src/lib/site'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Create a pool_creation_drafts row + Stripe Checkout for Custom Pool.
 * No pool is created until the billing webhook materializes the draft.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const rawPayload =
    body && typeof body === 'object' && 'payload' in body
      ? (body as { payload: unknown }).payload
      : body

  const validated = await validatePoolCreationDraftPayload(admin, rawPayload)
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, field: validated.field ?? null },
      { status: 400 },
    )
  }

  let priceId: string
  try {
    priceId = resolveCustomPoolPriceId()
  } catch (err) {
    console.error('pool-drafts/checkout: price env missing', err)
    return NextResponse.json(
      { error: 'billing_misconfigured' },
      { status: 500 },
    )
  }

  const { data: draft, error: draftError } = await admin
    .from('pool_creation_drafts')
    .insert({
      user_id: user.id,
      payload: validated.payload,
    })
    .select('id')
    .single()

  if (draftError || !draft?.id) {
    console.error('pool-drafts/checkout: draft insert failed', draftError)
    return NextResponse.json({ error: 'draft_failed' }, { status: 500 })
  }

  const draftId = draft.id as string
  const successUrl = `${siteUrl}/create?checkout=success&draft_id=${encodeURIComponent(draftId)}`
  const cancelUrl = `${siteUrl}/create?checkout=cancel`

  try {
    const customerId = await getOrCreateStripeCustomer(user)
    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        draft_id: draftId,
        buyer_user_id: user.id,
      },
    })

    if (!session.url) {
      console.error('pool-drafts/checkout: session missing url', {
        sessionId: session.id,
        draftId,
        userId: user.id,
      })
      return NextResponse.json({ error: 'checkout_failed' }, { status: 500 })
    }

    const { error: sessionLinkError } = await admin
      .from('pool_creation_drafts')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', draftId)

    if (sessionLinkError) {
      console.error('pool-drafts/checkout: session id link failed', {
        draftId,
        sessionId: session.id,
        message: sessionLinkError.message,
      })
      // Checkout URL still valid — webhook can attach session id via metadata.
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      draftId,
    })
  } catch (err) {
    console.error('pool-drafts/checkout: Stripe error', {
      draftId,
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
