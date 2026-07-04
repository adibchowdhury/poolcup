import type { SupabaseClient } from '@supabase/supabase-js'
import { getJoinPoolErrorMessage } from '@/src/lib/join-pool-errors'
import { parseInviteCodeInput } from './parse-invite-code'

type PoolJoinRow = {
  id: string
  name: string
  invite_code: string
  accepting_members: boolean | null
}

export type JoinPoolMobileResult =
  | { status: 'success'; poolId: string; inviteCode: string; poolName: string }
  | { status: 'already_member'; poolId: string; inviteCode: string }
  | { status: 'not_found' }
  | { status: 'closed'; poolName: string }
  | { status: 'validation_error'; message: string }
  | { status: 'error'; message: string }

export async function joinPoolMobile(
  supabase: SupabaseClient,
  userId: string,
  inviteCodeRaw: string,
  displayName: string,
): Promise<JoinPoolMobileResult> {
  const inviteCode = parseInviteCodeInput(inviteCodeRaw)

  if (!inviteCode) {
    return { status: 'validation_error', message: 'Invite code is required' }
  }

  const trimmedDisplayName = displayName.trim()
  if (!trimmedDisplayName) {
    return {
      status: 'validation_error',
      message: 'First name and last name are required',
    }
  }

  const { data: poolData, error: poolError } = await supabase
    .from('pools')
    .select('id, name, invite_code, accepting_members')
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (poolError || !poolData) {
    return { status: 'not_found' }
  }

  const pool = poolData as PoolJoinRow

  if (pool.accepting_members === false) {
    return { status: 'closed', poolName: pool.name }
  }

  const { data: existingMember, error: memberLookupError } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', pool.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberLookupError) {
    console.error('Failed to check pool membership:', memberLookupError.message)
    return {
      status: 'error',
      message: 'Unable to join this pool. Please try again.',
    }
  }

  if (existingMember) {
    return {
      status: 'already_member',
      poolId: pool.id,
      inviteCode: pool.invite_code,
    }
  }

  const { error: joinError } = await supabase.from('pool_members').insert({
    pool_id: pool.id,
    user_id: userId,
    display_name: trimmedDisplayName,
  })

  if (joinError) {
    return { status: 'error', message: getJoinPoolErrorMessage(joinError) }
  }

  const { error: referralError } = await supabase.rpc('award_referral_points', {
    p_pool_id: pool.id,
  })

  if (referralError) {
    console.error('Referral points award failed:', referralError.message)
  }

  return {
    status: 'success',
    poolId: pool.id,
    inviteCode: pool.invite_code,
    poolName: pool.name,
  }
}
