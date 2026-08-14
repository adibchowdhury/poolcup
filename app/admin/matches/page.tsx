import { notFound } from 'next/navigation'
import { AdminMatchesDashboard } from '@/components/admin/admin-matches-dashboard'
import { AdminShell } from '@/components/admin/admin-shell'
import { requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Matches | PoolCup Admin',
  robots: { index: false, follow: false },
}

export default async function AdminMatchesPage() {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  return (
    <AdminShell title="Matches">
      <AdminMatchesDashboard />
    </AdminShell>
  )
}
