import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminUsersDashboard } from '@/components/admin/admin-users-dashboard'
import { requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Users | PoolCup Admin',
  robots: { index: false, follow: false },
}

export default async function AdminUsersPage() {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  return (
    <AdminShell title="Users">
      <AdminUsersDashboard />
    </AdminShell>
  )
}
