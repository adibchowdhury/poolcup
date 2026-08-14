import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { fetchBannedUserIdsAmong } from '@/src/lib/banned-users'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

/**
 * Returns banned user ids among members of a pool (for leaderboard filtering).
 * Requires an authenticated pool member. Does not remove membership rows.
 */
export async function GET(_request: Request, context: Ctx) {
  const { poolId } = await context.params
  if (!poolId) {
    return NextResponse.json({ error: 'poolId_required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership, error: memberError } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: members, error: membersError } = await supabase
    .from('pool_members')
    .select('user_id')
    .eq('pool_id', poolId)

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 })
  }

  const userIds = (members ?? [])
    .map((row) => row.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  try {
    const admin = createAdminSupabaseClient()
    const banned = await fetchBannedUserIdsAmong(admin, userIds)
    return NextResponse.json({ bannedUserIds: [...banned] })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to load bans',
      },
      { status: 500 },
    )
  }
}
