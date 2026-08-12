import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import type { NotificationRow } from '@/src/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get('limit')) || 30),
  )
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

  const { data, error } = await supabase.rpc('get_notifications', {
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items: NotificationRow[] = (Array.isArray(data) ? data : []).map(
    (row) => ({
      id: String(row.id),
      category: String(row.category ?? ''),
      title: String(row.title ?? ''),
      body: row.body == null ? null : String(row.body),
      data:
        row.data && typeof row.data === 'object'
          ? (row.data as Record<string, unknown>)
          : null,
      read_at: row.read_at == null ? null : String(row.read_at),
      created_at: String(row.created_at ?? ''),
    }),
  )

  return NextResponse.json({ items })
}
