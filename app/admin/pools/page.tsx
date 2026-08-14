import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminPoolsDashboard } from '@/components/admin/admin-pools-dashboard'
import { requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Pools | PoolCup Admin',
  robots: { index: false, follow: false },
}

export default async function AdminPoolsPage() {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  return (
    <AdminShell title="Pools">
      <AdminPoolsDashboard />
    </AdminShell>
  )
}
