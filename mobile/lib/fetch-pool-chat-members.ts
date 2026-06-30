import type { SupabaseClient } from '@supabase/supabase-js'

export type PoolChatMemberProfile = {
  displayName: string
  avatar: string | null
}

type PoolMemberRow = {
  id: string
  user_id: string
  display_name: string
}

type AvatarRow = {
  member_id: string
  avatar: string | null
}

/** Same lookups as app/pool/[invite_code]/page.tsx for chat member display. */
export async function fetchPoolChatMemberProfiles(
  supabase: SupabaseClient,
  poolId: string,
): Promise<Map<string, PoolChatMemberProfile>> {
  const profilesByUserId = new Map<string, PoolChatMemberProfile>()

  const { data: membersData, error: membersError } = await supabase
    .from('pool_members')
    .select('id, user_id, display_name')
    .eq('pool_id', poolId)

  if (membersError) {
    console.error('Failed to load pool members for chat:', membersError.message)
    return profilesByUserId
  }

  const avatarByMemberId = new Map<string, string | null>()
  const { data: avatarRows, error: avatarError } = await supabase.rpc(
    'get_pool_member_avatars',
    { p_pool_id: poolId },
  )

  if (avatarError) {
    console.error('Failed to load pool member avatars for chat:', avatarError.message)
  } else {
    for (const row of (avatarRows ?? []) as AvatarRow[]) {
      avatarByMemberId.set(String(row.member_id), row.avatar ?? null)
    }
  }

  for (const member of (membersData ?? []) as PoolMemberRow[]) {
    profilesByUserId.set(member.user_id, {
      displayName: member.display_name?.trim() || 'Member',
      avatar: avatarByMemberId.get(member.id) ?? null,
    })
  }

  return profilesByUserId
}
