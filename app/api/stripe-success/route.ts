import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const poolId = searchParams.get('pool_id')

  if (!sessionId || !poolId) {
    return NextResponse.redirect(
      new URL('/dashboard?error=missing_params', request.url),
    )
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not configured')
      return NextResponse.redirect(
        new URL('/dashboard?error=payment_failed', request.url),
      )
    }

    const stripe = new Stripe(stripeSecretKey)
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return NextResponse.redirect(
        new URL('/dashboard?error=payment_failed', request.url),
      )
    }

    const supabase = createAdminSupabaseClient()
    const { error } = await supabase
      .from('pools')
      .update({
        payment_status: 'active',
        stripe_session_id: sessionId,
      })
      .eq('id', poolId)

    if (error) {
      console.error('Failed to update pool payment status:', error.message)
      return NextResponse.redirect(
        new URL('/dashboard?error=payment_failed', request.url),
      )
    }

    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('stripe-success error:', error)
    return NextResponse.redirect(
      new URL('/dashboard?error=payment_failed', request.url),
    )
  }
}
