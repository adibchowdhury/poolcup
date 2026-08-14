import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminPoolDetailView } from '@/components/admin/admin-pool-detail-view'
import { requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Pool detail | PoolCup Admin',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ poolId: string }> }

export default async function AdminPoolDetailPage({ params }: Props) {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  const { poolId } = await params

  return (
    <AdminShell title="Pool detail">
      <AdminPoolDetailView poolId={poolId} />
    </AdminShell>
  )
}
