import type { SupabaseClient } from '@supabase/supabase-js'

export const LAST_VIEWED_POOL_INVITE_CODE_KEY = 'last_viewed_pool_invite_code'

export type UserPoolRef = {
  id: string
  inviteCode: string
  name?: string
}

export function readLastViewedPoolInviteCode(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return localStorage.getItem(LAST_VIEWED_POOL_INVITE_CODE_KEY)
  } catch {
    return null
  }
}

export function writeLastViewedPoolInviteCode(inviteCode: string): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(LAST_VIEWED_POOL_INVITE_CODE_KEY, inviteCode)
  } catch {
    // Ignore quota / privacy errors.
  }
}

export function resolveMatchHref(
  matchId: string,
  pools: UserPoolRef[],
  explicitInviteCode?: string | null,
): string {
  if (explicitInviteCode) {
    return `/pool/${explicitInviteCode}/match/${matchId}`
  }

  const lastViewed = readLastViewedPoolInviteCode()
  if (lastViewed && pools.some((pool) => pool.inviteCode === lastViewed)) {
    return `/pool/${lastViewed}/match/${matchId}`
  }

  if (pools.length > 0) {
    return `/pool/${pools[0]!.inviteCode}/match/${matchId}`
  }

  return '/create'
}

type PoolSummaryRow = {
  pools:
    | { id: string; name: string; invite_code: string }
    | { id: string; name: string; invite_code: string }[]
    | null
}

export async function fetchUserPoolSummaries(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserPoolRef[]> {
  const { data, error } = await supabase
    .from('pool_members')
    .select('pools(id, name, invite_code)')
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to load user pool summaries:', error.message)
    return []
  }

  const pools: UserPoolRef[] = []

  for (const row of (data ?? []) as PoolSummaryRow[]) {
    const poolRaw = row.pools
    const pool = Array.isArray(poolRaw) ? poolRaw[0] : poolRaw
    if (!pool) continue

    pools.push({
      id: pool.id,
      name: pool.name,
      inviteCode: pool.invite_code,
    })
  }

  return pools
}
