import type { SupabaseClient } from '@supabase/supabase-js'

export type UserPoolChatRow = {
  pool_id: string
  pool_name: string
  member_count: number
  last_message_content: string | null
  last_message_at: string | null
  last_message_user_id: string | null
  unread_count: number
}

export type PoolChatMemberPreview = {
  memberId: string
  userId: string
  name: string
  isYou: boolean
  avatar: string | null
  customAvatarUrl: string | null
}

export type PoolChatInboxItem = UserPoolChatRow & {
  inviteCode: string
  /** Preset filename under /pool_avatars. */
  poolAvatar: string | null
  /** Custom uploaded emblem URL. */
  poolEmblemUrl: string | null
  members: PoolChatMemberPreview[]
}

const VISIBLE_MEMBER_COUNT = 4

type PoolMemberRow = {
  id: string
  pool_id: string
  user_id: string
  display_name: string
}

type PoolAvatarBatchRow = {
  pool_id: string
  member_id: string
  user_id: string
  display_name: string
  avatar: string | null
  custom_avatar_url: string | null
}

export function getVisibleMemberOverflow(memberCount: number): number {
  return Math.max(0, memberCount - VISIBLE_MEMBER_COUNT)
}

export function getVisibleMembers(
  members: PoolChatMemberPreview[],
): PoolChatMemberPreview[] {
  return members.slice(0, VISIBLE_MEMBER_COUNT)
}

export function formatChatMemberNames(
  members: PoolChatMemberPreview[],
  memberCount: number,
): string {
  const visible = getVisibleMembers(members)
  const names = visible.map((member) => member.name).join(', ')
  const overflow = getVisibleMemberOverflow(memberCount)

  if (!names) return ''
  if (overflow > 0) return `${names} +${overflow}`
  return names
}

export function poolChatHasMessage(item: {
  last_message_content: string | null
}): boolean {
  return (
    item.last_message_content != null && item.last_message_content.trim() !== ''
  )
}

export function formatPoolChatLastMessagePreview(
  item: Pick<
    UserPoolChatRow,
    'last_message_content' | 'last_message_user_id'
  >,
  currentUserId: string,
  members: PoolChatMemberPreview[],
): string {
  if (!poolChatHasMessage(item)) return 'No messages yet'

  const content = item.last_message_content!.trim()
  const senderId = item.last_message_user_id

  if (!senderId) return content

  if (senderId === currentUserId) return `You: ${content}`

  const sender = members.find((member) => member.userId === senderId)
  const senderName = sender?.name?.trim() || 'Member'
  return `${senderName}: ${content}`
}

export async function fetchUserPoolChats(
  supabase: SupabaseClient,
): Promise<UserPoolChatRow[]> {
  const { data, error } = await supabase.rpc('get_user_pool_chats')

  if (error) {
    console.error('Failed to fetch user pool chats:', error.message)
    return []
  }

  return (data ?? []) as UserPoolChatRow[]
}

type LastMessageSenderRow = {
  pool_id: string
  user_id: string
}

async function fetchLastMessageUserIdByPoolId(
  supabase: SupabaseClient,
  poolIds: string[],
): Promise<Map<string, string>> {
  const senderByPoolId = new Map<string, string>()
  if (poolIds.length === 0) return senderByPoolId

  const { data, error } = await supabase.rpc('get_pool_last_message_senders', {
    p_pool_ids: poolIds,
  })

  if (error) {
    console.error('Failed to load last message senders:', error.message)
    return senderByPoolId
  }

  for (const row of (data ?? []) as LastMessageSenderRow[]) {
    senderByPoolId.set(row.pool_id, row.user_id)
  }

  return senderByPoolId
}

type PoolInboxMeta = {
  inviteCode: string
  avatar: string | null
  emblemUrl: string | null
}

async function fetchPoolInboxMetaByPoolId(
  supabase: SupabaseClient,
  poolIds: string[],
): Promise<Map<string, PoolInboxMeta>> {
  if (poolIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('pools')
    .select('id, invite_code, avatar, emblem_url')
    .in('id', poolIds)

  if (error) {
    console.error('Failed to load pool inbox meta:', error.message)
    return new Map()
  }

  return new Map(
    (data ?? []).map((pool) => [
      pool.id as string,
      {
        inviteCode: pool.invite_code as string,
        avatar: (pool.avatar as string | null) ?? null,
        emblemUrl: (pool.emblem_url as string | null) ?? null,
      },
    ]),
  )
}

async function fetchMemberPreviewsByPoolId(
  supabase: SupabaseClient,
  poolIds: string[],
  currentUserId: string,
): Promise<Map<string, PoolChatMemberPreview[]>> {
  const membersByPoolId = new Map<string, PoolChatMemberPreview[]>()
  if (poolIds.length === 0) return membersByPoolId

  const { data: memberRows, error: memberError } = await supabase
    .from('pool_members')
    .select('id, pool_id, user_id, display_name')
    .in('pool_id', poolIds)
    .order('joined_at', { ascending: true })

  if (memberError) {
    console.error('Failed to load pool members for chat inbox:', memberError.message)
    return membersByPoolId
  }

  const avatarByMemberId = new Map<
    string,
    { avatar: string | null; customAvatarUrl: string | null }
  >()
  const { data: avatarRows, error: avatarError } = await supabase.rpc(
    'get_pool_member_avatars_batch',
    { p_pool_ids: poolIds },
  )

  if (avatarError) {
    console.error(
      'Failed to load member avatars for chat inbox:',
      avatarError.message,
    )
  } else {
    for (const row of (avatarRows ?? []) as PoolAvatarBatchRow[]) {
      avatarByMemberId.set(String(row.member_id), {
        avatar: row.avatar ?? null,
        customAvatarUrl: row.custom_avatar_url ?? null,
      })
    }
  }

  for (const row of (memberRows ?? []) as PoolMemberRow[]) {
    const displayName = row.display_name?.trim() || 'Member'
    const members = membersByPoolId.get(row.pool_id) ?? []
    const avatarFields = avatarByMemberId.get(row.id)
    members.push({
      memberId: row.id,
      userId: row.user_id,
      name: displayName,
      isYou: row.user_id === currentUserId,
      avatar: avatarFields?.avatar ?? null,
      customAvatarUrl: avatarFields?.customAvatarUrl ?? null,
    })
    membersByPoolId.set(row.pool_id, members)
  }

  return membersByPoolId
}

export async function fetchPoolChatInbox(
  supabase: SupabaseClient,
  userId: string,
): Promise<PoolChatInboxItem[]> {
  const rows = await fetchUserPoolChats(supabase)
  if (rows.length === 0) return []

  const poolIds = rows.map((row) => row.pool_id)
  const [poolMetaById, membersByPoolId, lastMessageSenderByPoolId] =
    await Promise.all([
      fetchPoolInboxMetaByPoolId(supabase, poolIds),
      fetchMemberPreviewsByPoolId(supabase, poolIds, userId),
      fetchLastMessageUserIdByPoolId(supabase, poolIds),
    ])

  return rows
    .map((row) => {
      const meta = poolMetaById.get(row.pool_id)
      return {
        ...row,
        last_message_user_id: lastMessageSenderByPoolId.get(row.pool_id) ?? null,
        inviteCode: meta?.inviteCode ?? '',
        poolAvatar: meta?.avatar ?? null,
        poolEmblemUrl: meta?.emblemUrl ?? null,
        members: membersByPoolId.get(row.pool_id) ?? [],
      }
    })
    .filter((row) => row.inviteCode !== '')
}
