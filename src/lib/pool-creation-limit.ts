/** @deprecated Phase 1: pool creation is unlimited. Kept for callers / soft-fail messaging. */
export const FREE_TIER_OWNED_POOL_LIMIT = 3

export type PoolCreationQuota = {
  ownedPoolCount: number
  /** null = unlimited */
  limit: number | null
  canCreateMore: boolean
}

/**
 * Phase 1+: creation is unlimited.
 * Owned count remains informational.
 */
export function buildPoolCreationQuota(
  ownedPoolCount: number,
): PoolCreationQuota {
  return {
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
