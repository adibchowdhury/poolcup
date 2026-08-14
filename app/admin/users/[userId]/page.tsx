import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminUserDetailView } from '@/components/admin/admin-user-detail-view'
import { requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'User detail | PoolCup Admin',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ userId: string }> }

export default async function AdminUserDetailPage({ params }: Props) {
  const admin = await requireAdminUser()
  if (!admin) notFound()

  const { userId } = await params

  return (
    <AdminShell title="User detail">
      <AdminUserDetailView userId={userId} />
    </AdminShell>
  )
}
