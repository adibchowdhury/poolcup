import 'server-only'
import Stripe from 'stripe'

/**
 * Shared server-side Stripe client for Custom Pool Checkout (and related billing).
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

/** One-time Custom Pool upgrade price ($9.99). */
export function resolveCustomPoolPriceId(): string {
  const priceId = process.env.STRIPE_PRICE_CUSTOM_POOL?.trim()
  if (!priceId) {
    throw new Error('STRIPE_PRICE_CUSTOM_POOL is not configured')
  }
  return priceId
}
