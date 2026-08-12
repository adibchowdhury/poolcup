import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { id?: string }
  try {
    body = (await request.json()) as { id?: string }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const id = body.id?.trim()
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 })
  }

  const { error } = await supabase.rpc('mark_notification_read', { p_id: id })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
