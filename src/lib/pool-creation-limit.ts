import type { BillingTier } from '@/src/lib/billing-types'

/** @deprecated Phase 1: pool creation is unlimited for all tiers. Kept for callers. */
export const FREE_TIER_OWNED_POOL_LIMIT = 3

export type PoolCreationQuota = {
  tier: BillingTier
  ownedPoolCount: number
  /** null = unlimited (Phase 1: always null) */
  limit: number | null
  canCreateMore: boolean
}

/** @deprecated Phase 1: always unlimited. */
export function poolCreationLimitForTier(_tier: BillingTier): number | null {
  return null
}

/**
 * Phase 1: creation is unlimited for every tier.
 * `ownedPoolCount` + `tier` remain informational (create flow still uses tier
 * for Commissioner branding gates).
 */
export function buildPoolCreationQuota(
  tier: BillingTier,
  ownedPoolCount: number,
): PoolCreationQuota {
  return {
    tier,
    ownedPoolCount: Math.max(0, ownedPoolCount),
    limit: null,
    canCreateMore: true,
  }
}

/** Matches the DB trigger message while it may still exist during deploy. */
export function isPoolCreationLimitError(error: unknown): boolean {
  const text =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : ''
  return (
    text.includes('pool_creation_limit_reached') ||
    text.includes('pool_creation_limit')
  )
}

/** Generic copy if the DB trigger still fires before MCP drop. */
export const POOL_CREATION_LIMIT_MESSAGE =
  'Could not create this pool right now. Please try again.'
