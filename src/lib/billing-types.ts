export type BillingTier = 'free' | 'pro' | 'commissioner'

export type BillingSnapshot = {
  tier: BillingTier
  subscriptionStatus: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: string | null
}
