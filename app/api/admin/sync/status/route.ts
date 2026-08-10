import { NextResponse } from 'next/server'
import { fetchSyncStatus, requireAdminUser } from '@/src/lib/admin-sync'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows, error } = await fetchSyncStatus(admin.supabase)
  if (error) {
    return NextResponse.json({ error, rows: [] }, { status: 500 })
  }
  return NextResponse.json({ rows })
}
