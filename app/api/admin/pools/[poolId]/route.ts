import { NextResponse } from 'next/server'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

export async function GET(_request: Request, context: Ctx) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { poolId } = await context.params
  if (!poolId) {
    return NextResponse.json({ error: 'poolId_required' }, { status: 400 })
  }

  const { data, error } = await admin.service.rpc('admin_pool_detail', {
    p_admin_id: admin.userId,
    p_pool_id: poolId,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 500 },
    )
  }

  // Cheap Custom Pool signal — admin_pool_detail RPC does not yet return plan.
  const { data: planRow } = await admin.service
    .from('pools')
    .select('plan')
    .eq('id', poolId)
    .maybeSingle()

  const detail =
    data && typeof data === 'object'
      ? {
          ...(data as Record<string, unknown>),
          pool: {
            ...(((data as { pool?: Record<string, unknown> }).pool ??
              {}) as Record<string, unknown>),
            plan: planRow?.plan ?? null,
          },
        }
      : data

  return NextResponse.json({ detail })
}
