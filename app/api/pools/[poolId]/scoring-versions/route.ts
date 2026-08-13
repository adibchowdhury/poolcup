import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

function num(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function str(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/**
 * Member-visible scoring config history (transparency).
 */
export async function GET(request: Request, context: Ctx) {
  const { poolId } = await context.params
  if (!poolId) {
    return NextResponse.json({ error: 'poolId_required' }, { status: 400 })
  }

  const url = new URL(request.url)
  const limitRaw = Number(url.searchParams.get('limit') ?? '40')
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.floor(limitRaw)))
    : 40

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error(
      'scoring-versions: membership check failed',
      membershipError.message,
    )
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('pool_scoring_versions')
    .select('*')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('pool_scoring_versions load failed:', error.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  const mapped = ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const actorId =
      str(row, 'actor_id', 'changed_by', 'created_by', 'user_id') ?? null
    return {
      id: str(row, 'id') ?? null,
      version: num(row, 'version', 'version_number', 'version_n'),
      style: str(row, 'scoring_style', 'style') ?? 'classic',
      exact: num(row, 'score_exact_points', 'exact', 'exact_points'),
      winner: num(row, 'score_winner_points', 'winner', 'winner_points'),
      draw: num(row, 'score_draw_points', 'draw', 'draw_points'),
      actorId,
      actorName: null as string | null,
      createdAt: str(row, 'created_at', 'changed_at', 'recorded_at'),
    }
  })

  const actorIds = [
    ...new Set(mapped.map((r) => r.actorId).filter(Boolean) as string[]),
  ]
  if (actorIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, display_name, username')
      .in('id', actorIds)

    const byId = new Map(
      (users ?? []).map((u) => [
        String(u.id),
        (typeof u.display_name === 'string' && u.display_name.trim()
          ? u.display_name.trim()
          : null) ||
          (typeof u.username === 'string' && u.username.trim()
            ? u.username.trim()
            : null) ||
          'Commissioner',
      ]),
    )

    for (const row of mapped) {
      row.actorName = row.actorId
        ? byId.get(row.actorId) ?? 'Commissioner'
        : null
    }
  }

  mapped.sort((a, b) => {
    const av = a.version
    const bv = b.version
    if (av != null && bv != null && av !== bv) return bv - av
    const at = a.createdAt ? Date.parse(a.createdAt) : 0
    const bt = b.createdAt ? Date.parse(b.createdAt) : 0
    return bt - at
  })

  return NextResponse.json({ rows: mapped })
}
