import { notFound } from 'next/navigation'
import { AdminAuditDashboard } from '@/components/admin/admin-audit-dashboard'
import { AdminShell } from '@/components/admin/admin-shell'
import { requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Audit log | PoolCup Admin',
  robots: { index: false, follow: false },
}

export default async function AdminAuditPage() {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  return (
    <AdminShell title="Audit log">
      <AdminAuditDashboard />
    </AdminShell>
  )
}
