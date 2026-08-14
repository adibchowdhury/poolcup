import { notFound } from 'next/navigation'
import { AdminMetricsDashboard } from '@/components/admin/admin-metrics-dashboard'
import { AdminShell } from '@/components/admin/admin-shell'
import { requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Admin overview | PoolCup',
  robots: { index: false, follow: false },
}

export default async function AdminHubPage() {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  return (
    <AdminShell title="Overview">
      <AdminMetricsDashboard />
    </AdminShell>
  )
}
