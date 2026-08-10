import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export type LeavePoolErrorCode =
  | 'creator_must_transfer'
  | 'creator_only_member'
  | 'unknown'

export type LeavePoolResult =
  | { ok: true }
  | { ok: false; code: LeavePoolErrorCode; message: string }

function classifyLeaveError(error: PostgrestError | Error | null): LeavePoolResult {
  const message =
    (error && 'message' in error && error.message) ||
    'Could not leave the pool. Please try again.'
  const lower = message.toLowerCase()

  if (
    lower.includes('creator_must_transfer') ||
    lower.includes('must_transfer')
  ) {
    return {
      ok: false,
      code: 'creator_must_transfer',
      message:
        'Transfer ownership to another member before you leave this pool.',
    }
  }

  if (
    lower.includes('creator_only_member') ||
    lower.includes('only_member')
  ) {
    return {
      ok: false,
      code: 'creator_only_member',
      message:
        'You are the only member. Delete the pool instead of leaving.',
    }
  }

  return { ok: false, code: 'unknown', message }
}

/** Member self-leave via DB RPC. Creators may get transfer/delete errors. */
export async function leavePool(
  client: SupabaseClient,
  poolId: string,
): Promise<LeavePoolResult> {
  const { error } = await client.rpc('leave_pool', {
    p_pool_id: poolId,
  })

  if (error) return classifyLeaveError(error)
  return { ok: true }
}

/** Creator-only: assign a new host, then the old creator remains a member. */
export async function transferPoolOwnership(
  client: SupabaseClient,
  poolId: string,
  newOwnerUserId: string,
): Promise<{ error: string | null }> {
  const { error } = await client.rpc('transfer_pool_ownership', {
    p_pool_id: poolId,
    p_new_owner_user_id: newOwnerUserId,
  })

  if (error) {
    return {
      error: error.message || 'Could not transfer ownership. Please try again.',
    }
  }

  return { error: null }
}
