import { NextResponse } from 'next/server'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ userId: string }> }

export async function GET(_request: Request, context: Ctx) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: 'userId_required' }, { status: 400 })
  }

  const { data, error } = await admin.service.rpc('admin_user_detail', {
    p_admin_id: admin.userId,
    p_user_id: userId,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 500 },
    )
  }

  // Attach pools.plan onto owned pools for Custom Pool badges (RPC has no plan yet).
  const detail =
    data && typeof data === 'object'
      ? ({ ...(data as Record<string, unknown>) } as Record<string, unknown>)
      : null

  if (detail && Array.isArray(detail.pools_owned) && detail.pools_owned.length > 0) {
    const owned = detail.pools_owned as Array<{ id?: string }>
    const ids = owned.map((p) => p.id).filter((id): id is string => Boolean(id))
    if (ids.length > 0) {
      const { data: planRows } = await admin.service
        .from('pools')
        .select('id, plan')
        .in('id', ids)
      const byId = new Map(
        (planRows ?? []).map((row) => [row.id as string, row.plan as string | null]),
      )
      detail.pools_owned = owned.map((pool) => ({
        ...pool,
        plan: pool.id ? (byId.get(pool.id) ?? null) : null,
      }))
    }
  }

  return NextResponse.json({ detail: detail ?? data })
}
