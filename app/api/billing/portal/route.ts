import { NextResponse } from 'next/server'
import { getStripe } from '@/src/lib/stripe'
import { siteUrl } from '@/src/lib/site'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Authenticated Stripe Customer Portal session.
 * Customer id is resolved from the session user only — never from the request body.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const { data: row, error: loadError } = await admin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  if (loadError) {
    console.error('billing/portal: load failed', {
      userId: user.id,
      error: loadError.message,
    })
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  const customerId =
    typeof row?.stripe_customer_id === 'string'
      ? row.stripe_customer_id.trim()
      : ''

  if (!customerId) {
    return NextResponse.json(
      {
        error: 'no_billing_account',
        message:
          'No billing account yet. Upgrade to Pro or Commissioner first.',
      },
      { status: 400 },
    )
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/settings/billing`,
    })

    if (!session.url) {
      console.error('billing/portal: session missing url', {
        userId: user.id,
        customerId,
      })
      return NextResponse.json({ error: 'portal_failed' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('billing/portal: Stripe error', {
      userId: user.id,
      error: err instanceof Error ? err.message : err,
    })
    return NextResponse.json(
      {
        error: 'portal_failed',
        message: 'Could not open billing portal. Please try again.',
      },
      { status: 502 },
    )
  }
}
