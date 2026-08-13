import type { SupabaseClient } from '@supabase/supabase-js'

export type PoolCommissionerRole = {
  isOwner: boolean
  isAdmin: boolean
}

export async function fetchIsPoolOwner(
  admin: SupabaseClient,
  poolId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc('is_pool_owner', {
    p_pool_id: poolId,
    p_user_id: userId,
  })
  if (error) {
    console.error('is_pool_owner failed:', error.message)
    return false
  }
  return Boolean(data)
}

export async function fetchIsPoolAdmin(
  admin: SupabaseClient,
  poolId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc('is_pool_admin', {
    p_pool_id: poolId,
    p_user_id: userId,
  })
  if (error) {
    console.error('is_pool_admin failed:', error.message)
    return false
  }
  return Boolean(data)
}

export async function fetchPoolCommissionerRole(
  admin: SupabaseClient,
  poolId: string,
  userId: string,
): Promise<PoolCommissionerRole> {
  const [isOwner, isAdmin] = await Promise.all([
    fetchIsPoolOwner(admin, poolId, userId),
    fetchIsPoolAdmin(admin, poolId, userId),
  ])
  return { isOwner, isAdmin: isOwner || isAdmin }
}

export type PoolModerationAction =
  | 'name_edited'
  | 'description_edited'
  | 'pool_opened'
  | 'pool_closed'
  | 'member_removed'
  | 'theme_edited'
  | 'emblem_uploaded'
  | 'emblem_removed'
  | 'scoring_edited'
  | string

/** Service-role audit log for commissioner actions. */
export async function logPoolModeration(
  admin: SupabaseClient,
  params: {
    poolId: string
    actorId: string
    action: PoolModerationAction
    targetUserId?: string | null
    detail?: Record<string, unknown> | string | null
  },
): Promise<void> {
  const detail =
    params.detail == null
      ? null
      : typeof params.detail === 'string'
        ? params.detail
        : JSON.stringify(params.detail)

  const { error } = await admin.rpc('log_pool_moderation', {
    p_pool_id: params.poolId,
    p_actor_id: params.actorId,
    p_action: params.action,
    p_target_user_id: params.targetUserId ?? null,
    p_detail: detail,
  })

  if (error) {
    console.error('log_pool_moderation failed:', error.message, params.action)
  }
}

export type CoCommissionerRow = {
  userId: string
  displayName: string | null
  username: string | null
}

/** List co-commissioners (pool_admins), excluding the owner. */
export async function listCoCommissioners(
  admin: SupabaseClient,
  poolId: string,
): Promise<CoCommissionerRow[]> {
  const { data, error } = await admin
    .from('pool_admins')
    .select('user_id')
    .eq('pool_id', poolId)

  if (error) {
    console.error('listCoCommissioners failed:', error.message)
    return []
  }

  const userIds = (data ?? [])
    .map((row) => String((row as { user_id: string }).user_id))
    .filter(Boolean)
  if (userIds.length === 0) return []

  const { data: users, error: usersError } = await admin
    .from('users')
    .select('id, display_name, username')
    .in('id', userIds)

  if (usersError) {
    console.error('listCoCommissioners users failed:', usersError.message)
    return userIds.map((userId) => ({
      userId,
      displayName: null,
      username: null,
    }))
  }

  const byId = new Map(
    (users ?? []).map((u) => [
      String(u.id),
      {
        displayName:
          typeof u.display_name === 'string' ? u.display_name : null,
        username: typeof u.username === 'string' ? u.username : null,
      },
    ]),
  )

  return userIds.map((userId) => ({
    userId,
    displayName: byId.get(userId)?.displayName ?? null,
    username: byId.get(userId)?.username ?? null,
  }))
}
