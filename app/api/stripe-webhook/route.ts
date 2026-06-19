import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { isValidDonorUserId } from '@/src/lib/stripe-donate-url'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.client_reference_id
  if (!userId) {
    console.warn(
      'stripe-webhook: checkout.session.completed missing client_reference_id',
      { sessionId: session.id, eventId: event.id },
    )
    return
  }

  if (!isValidDonorUserId(userId)) {
    console.warn('stripe-webhook: invalid client_reference_id', {
      clientReferenceId: userId,
      sessionId: session.id,
      eventId: event.id,
    })
    return
  }

  const amountCents = session.amount_total
  const currency = session.currency
  if (amountCents == null || !currency) {
    console.warn(
      'stripe-webhook: checkout.session.completed missing amount_total or currency',
      { sessionId: session.id, eventId: event.id },
    )
    return
  }

  const supabase = createAdminSupabaseClient()

  const { error: insertError } = await supabase.from('donations').upsert(
    {
      user_id: userId,
      stripe_event_id: event.id,
      stripe_session_id: session.id,
      amount_cents: amountCents,
      currency,
    },
    { onConflict: 'stripe_event_id', ignoreDuplicates: true },
  )

  if (insertError) {
    console.error('stripe-webhook: donations insert failed', {
      eventId: event.id,
      sessionId: session.id,
      userId,
      error: insertError.message,
    })
    throw insertError
  }

  const { error: supporterError } = await supabase
    .from('users')
    .update({ is_supporter: true })
    .eq('id', userId)

  if (supporterError) {
    console.error('stripe-webhook: is_supporter update failed', {
      eventId: event.id,
      userId,
      error: supporterError.message,
    })
    throw supporterError
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const rawBody = await request.text()
    event = Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.error('stripe-webhook: signature verification failed', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(
        event,
        event.data.object as Stripe.Checkout.Session,
      )
    } else {
      console.log('stripe-webhook: unhandled event type', event.type)
    }
  } catch (error) {
    console.error('stripe-webhook: handler error', {
      eventId: event.id,
      type: event.type,
      error,
    })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
