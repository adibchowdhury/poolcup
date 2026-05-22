import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

function dashboardRedirect(path: string): NextResponse {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  return NextResponse.redirect(`${siteUrl}${path}`)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const poolId = searchParams.get('pool_id')

  if (!sessionId || !poolId) {
    return dashboardRedirect('/dashboard?error=missing_params')
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not configured')
      return dashboardRedirect('/dashboard?error=payment_failed')
    }

    const stripe = new Stripe(stripeSecretKey)
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return dashboardRedirect('/dashboard?error=payment_failed')
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
      return dashboardRedirect('/dashboard?error=payment_failed')
    }

    return dashboardRedirect('/dashboard')
  } catch (error) {
    console.error('stripe-success error:', error)
    return dashboardRedirect('/dashboard?error=payment_failed')
  }
}
