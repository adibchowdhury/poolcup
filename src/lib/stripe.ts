import 'server-only'
import Stripe from 'stripe'

/**
 * Shared server-side Stripe client for subscription billing.
 * Do not use for the donate Payment Link flow (`stripe-donate-url`).
 */
let stripeSingleton: Stripe | null = null

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton

  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  stripeSingleton = new Stripe(key, {
    // Pin to the API version shipped with the installed `stripe` package.
    apiVersion: '2026-07-29.dahlia',
    typescript: true,
  })
  return stripeSingleton
}

export type BillingPlan = 'pro' | 'commissioner'

export function resolveBillingPriceId(plan: BillingPlan): string {
  const envKey =
    plan === 'pro' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_COMMISSIONER'
  const priceId = process.env[envKey]?.trim()
  if (!priceId) {
    throw new Error(`${envKey} is not configured`)
  }
  return priceId
}

export function isBillingPlan(value: unknown): value is BillingPlan {
  return value === 'pro' || value === 'commissioner'
}
