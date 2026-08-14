import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminWebhooksDashboard } from '@/components/admin/admin-webhooks-dashboard'
import { requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Failed webhooks | PoolCup Admin',
  robots: { index: false, follow: false },
}

export default async function AdminWebhooksPage() {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  return (
    <AdminShell title="Failed webhooks">
      <AdminWebhooksDashboard />
    </AdminShell>
  )
}
