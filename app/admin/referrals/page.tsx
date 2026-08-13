import { notFound } from 'next/navigation'
import { AdminReferralsDashboard } from '@/components/admin/admin-referrals-dashboard'
import { requireAdminUser } from '@/src/lib/admin-sync'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Referrals | PoolCup Admin',
  robots: { index: false, follow: false },
}

export type ReferralPerformanceRow = {
  referrer_id: string
  referrer_name: string | null
  referrer_username: string | null
  signups_referred: number
  pool_joins_driven: number
  invite_xp_earned: number
}

export default async function AdminReferralsPage() {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  const service = createAdminSupabaseClient()
  const { data, error } = await service.rpc('get_referral_performance', {
    p_admin_id: admin.userId,
    p_limit: 100,
  })

  const rows = (Array.isArray(data) ? data : []) as ReferralPerformanceRow[]

  return (
    <AdminReferralsDashboard
      initialRows={rows}
      initialError={error?.message ?? null}
    />
  )
}
