import 'server-only'
import type { User } from '@supabase/supabase-js'
import { getStripe } from '@/src/lib/stripe'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

/**
 * One Stripe Customer per PoolCup user. Reuses users.stripe_customer_id when set.
 * Persists new customer IDs via service role (never trusts the client).
 */
export async function getOrCreateStripeCustomer(user: User): Promise<string> {
  const admin = createAdminSupabaseClient()

  const { data: row, error: loadError } = await admin
    .from('users')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .maybeSingle()

  if (loadError) {
    console.error('getOrCreateStripeCustomer: load failed', {
      userId: user.id,
      error: loadError.message,
    })
    throw new Error('Could not load billing profile')
  }

  const existing =
    typeof row?.stripe_customer_id === 'string'
      ? row.stripe_customer_id.trim()
      : ''
  if (existing) {
    return existing
  }

  const email =
    (typeof row?.email === 'string' && row.email.trim()) ||
    user.email?.trim() ||
    undefined

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email,
    metadata: {
      poolcup_user_id: user.id,
    },
  })

  const { error: saveError } = await admin
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', user.id)

  if (saveError) {
    console.error('getOrCreateStripeCustomer: save failed', {
      userId: user.id,
      customerId: customer.id,
      error: saveError.message,
    })
    throw new Error('Could not save Stripe customer')
  }

  return customer.id
}
