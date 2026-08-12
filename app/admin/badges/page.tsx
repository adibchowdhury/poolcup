import { notFound } from 'next/navigation'
import { AdminBadgesDashboard } from '@/components/admin/admin-badges-dashboard'
import { requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Badge corrections | PoolCup Admin',
  robots: { index: false, follow: false },
}

export default async function AdminBadgesPage() {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  return <AdminBadgesDashboard />
}
