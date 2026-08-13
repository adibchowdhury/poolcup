import { NextResponse } from 'next/server'
import { fetchIsPoolAdmin } from '@/src/lib/pool-admin'
import { sanitizeFilenamePart } from '@/src/lib/csv'
import {
  buildPredictionsCsv,
  csvAttachmentResponse,
  fetchPredictionExportRows,
  loadPoolExportMeta,
} from '@/src/lib/pool-export'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

/** Admin-only: CSV export of pool predictions via export_pool_predictions. */
export async function GET(_request: Request, context: Ctx) {
  const { poolId } = await context.params
  if (!poolId) {
    return NextResponse.json({ error: 'poolId_required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const isAdmin = await fetchIsPoolAdmin(admin, poolId, user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const meta = await loadPoolExportMeta(admin, poolId)
  if (!meta) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { rows, error } = await fetchPredictionExportRows(
    admin,
    user.id,
    poolId,
  )
  if (error) {
    console.error('export_pool_predictions failed:', error)
    const lower = error.toLowerCase()
    if (lower.includes('not_pool_admin')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'export_failed' }, { status: 500 })
  }

  const date = meta.generatedAt.slice(0, 10)
  const filename = `${sanitizeFilenamePart(meta.name)}-predictions-${date}.csv`
  const csv = buildPredictionsCsv(meta, rows)
  return csvAttachmentResponse(csv, filename, rows.length)
}
