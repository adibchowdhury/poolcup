import { NextResponse } from 'next/server'
import { fetchPoolHasCommissionerTools } from '@/src/lib/commissioner-entitlements'
import {
  fetchPoolCommissionerRole,
  listCoCommissioners,
} from '@/src/lib/pool-admin'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

/**
 * Bootstrap commissioner panel: role, co-admins, description, activity counts,
 * and whether this pool unlocks Commissioner tools (owner tier).
 * Admin-only (owner or co-commissioner).
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
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const role = await fetchPoolCommissionerRole(admin, poolId, user.id)
  if (!role.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: pool, error: poolError } = await admin
    .from('pools')
    .select('id, name, description, creator_id, accepting_members')
    .eq('id', poolId)
    .maybeSingle()

  if (poolError || !pool) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const [{ count: memberCount }, poolHasCommissionerTools, coCommissioners] =
    await Promise.all([
      admin
        .from('pool_members')
        .select('id', { count: 'exact', head: true })
        .eq('pool_id', poolId),
      fetchPoolHasCommissionerTools(admin, poolId),
      listCoCommissioners(admin, poolId),
    ])

  return NextResponse.json({
    role,
    pool: {
      id: pool.id,
      name: pool.name,
      description: pool.description ?? null,
      creatorId: pool.creator_id,
      acceptingMembers: pool.accepting_members ?? true,
    },
    memberCount: Math.max(0, memberCount ?? 0),
    coCommissioners,
    poolHasCommissionerTools,
    canUseCommissionerTools: role.isAdmin && poolHasCommissionerTools,
  })
}
