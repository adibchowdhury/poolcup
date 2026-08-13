import { NextResponse } from 'next/server'
import type { BillingTier } from '@/src/lib/billing-types'
import { buildPoolCreationQuota } from '@/src/lib/pool-creation-limit'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Owned-pool creation quota for the authed user.
 * Counts pools where creator_id = user (join is never limited).
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

  const [{ data: userRow, error: userError }, { count, error: countError }] =
    await Promise.all([
      admin.from('users').select('tier').eq('id', user.id).maybeSingle(),
      admin
        .from('pools')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', user.id),
    ])

  if (userError) {
    console.error('creation-quota: load tier failed', {
      userId: user.id,
      error: userError.message,
    })
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }
  if (countError) {
    console.error('creation-quota: count pools failed', {
      userId: user.id,
      error: countError.message,
    })
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  const rawTier = typeof userRow?.tier === 'string' ? userRow.tier.trim() : 'free'
  const tier: BillingTier =
    rawTier === 'pro' || rawTier === 'commissioner' ? rawTier : 'free'

  const quota = buildPoolCreationQuota(tier, count ?? 0)

  return NextResponse.json({
    ...quota,
    owned_pool_count: quota.ownedPoolCount,
    can_create_more: quota.canCreateMore,
  })
}
