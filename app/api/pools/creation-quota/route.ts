import { NextResponse } from 'next/server'
import { buildPoolCreationQuota } from '@/src/lib/pool-creation-limit'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Owned-pool creation quota for the authed user.
 * Creation is unlimited; returns owned count only (no users.tier).
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()

  const { count, error: countError } = await admin
    .from('pools')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', user.id)

  if (countError) {
    console.error('creation-quota: count pools failed', {
      userId: user.id,
      error: countError.message,
    })
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  const quota = buildPoolCreationQuota(count ?? 0)

  return NextResponse.json({
    ...quota,
    owned_pool_count: quota.ownedPoolCount,
    can_create_more: true,
  })
}
