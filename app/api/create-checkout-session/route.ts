import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_SITE_URL is not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { poolId, userId } = body as {
      poolId?: string
      userId?: string
    }

    if (!poolId || !userId) {
      return NextResponse.json(
        { error: 'poolId and userId are required' },
        { status: 400 }
      )
    }

    const baseUrl = siteUrl.replace(/\/$/, '')
    const stripe = new Stripe(stripeSecretKey)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'PoolCup — World Cup Pool',
            },
            unit_amount: 1500,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/api/stripe-success?session_id={CHECKOUT_SESSION_ID}&pool_id=${encodeURIComponent(poolId)}`,
      cancel_url: `${baseUrl}/dashboard`,
      metadata: {
        poolId: String(poolId),
        userId: String(userId),
      },
    })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('create-checkout-session error:', error)

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode ?? 502 }
      )
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
