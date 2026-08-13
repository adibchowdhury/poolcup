import type { SupabaseClient } from '@supabase/supabase-js'

/** True when the pool owner's tier unlocks Commissioner tools. */
export async function fetchPoolHasCommissionerTools(
  admin: SupabaseClient,
  poolId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc('pool_has_commissioner_tools', {
    p_pool_id: poolId,
  })
  if (error) {
    console.error('pool_has_commissioner_tools failed:', error.message)
    return false
  }
  return Boolean(data)
}

/** True when the user is a pool admin AND the pool has Commissioner tools. */
export async function fetchCanUseCommissionerTools(
  admin: SupabaseClient,
  poolId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc('can_use_commissioner_tools', {
    p_pool_id: poolId,
    p_user_id: userId,
  })
  if (error) {
    console.error('can_use_commissioner_tools failed:', error.message)
    return false
  }
  return Boolean(data)
}

export function isCommissionerTierRequiredError(
  error: unknown,
): boolean {
  if (typeof error === 'string') {
    return error.includes('commissioner_tier_required')
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string') {
      return msg.includes('commissioner_tier_required')
    }
  }
  return false
}

export const COMMISSIONER_TIER_REQUIRED_TOAST =
  'This is a Commissioner feature'

/** Normalize API/RPC errors for UI toasts. */
export function messageForCommissionerGate(
  error: unknown,
  fallback: string,
): string {
  if (isCommissionerTierRequiredError(error)) {
    return COMMISSIONER_TIER_REQUIRED_TOAST
  }
  if (typeof error === 'string' && error.trim()) return error
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}
