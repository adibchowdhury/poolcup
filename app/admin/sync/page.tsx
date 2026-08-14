import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminSyncDashboard } from '@/components/admin/admin-sync-dashboard'
import { fetchSyncStatus, requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Sync status | PoolCup Admin',
  robots: { index: false, follow: false },
}

export default async function AdminSyncPage() {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  const { rows, error } = await fetchSyncStatus(admin.supabase)

  return (
    <AdminShell title="Ingestion">
      <AdminSyncDashboard initialRows={rows} initialError={error} />
    </AdminShell>
  )
}
