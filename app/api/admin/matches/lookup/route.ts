import { NextResponse } from 'next/server'
import type { AdminMatchLookupRow } from '@/src/lib/admin-console'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (!q) {
    return NextResponse.json({ matches: [] as AdminMatchLookupRow[] })
  }

  const { data, error } = await admin.service.rpc('admin_match_lookup', {
    p_admin_id: admin.userId,
    p_query: q,
    p_limit: 40,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 500 },
    )
  }

  return NextResponse.json({
    matches: (data ?? []) as AdminMatchLookupRow[],
  })
}
