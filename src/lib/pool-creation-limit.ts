import type { BillingTier } from '@/src/lib/billing-types'

/** Free & Pro owners may create this many pools; Commissioner is unlimited. */
export const FREE_TIER_OWNED_POOL_LIMIT = 3

export type PoolCreationQuota = {
  tier: BillingTier
  ownedPoolCount: number
  /** null = unlimited (Commissioner) */
  limit: number | null
  canCreateMore: boolean
}

export function poolCreationLimitForTier(tier: BillingTier): number | null {
  return tier === 'commissioner' ? null : FREE_TIER_OWNED_POOL_LIMIT
}

export function buildPoolCreationQuota(
  tier: BillingTier,
  ownedPoolCount: number,
): PoolCreationQuota {
  const limit = poolCreationLimitForTier(tier)
  const count = Math.max(0, ownedPoolCount)
  return {
    tier,
    ownedPoolCount: count,
    limit,
    canCreateMore: limit == null ? true : count < limit,
  }
}

export function isPoolCreationLimitError(error: unknown): boolean {
  if (typeof error === 'string') {
    return error.includes('pool_creation_limit_reached')
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    return typeof msg === 'string' && msg.includes('pool_creation_limit_reached')
  }
  return false
}

export const POOL_CREATION_LIMIT_MESSAGE =
  "You've reached the free limit of 3 pools. Upgrade to Commissioner for unlimited pools."
