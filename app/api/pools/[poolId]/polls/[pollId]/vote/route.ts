import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string; pollId: string }> }

type Body = { optionId?: string }

/** Member vote (upsert) via cast_poll_vote. */
export async function POST(request: Request, context: Ctx) {
  const { poolId, pollId } = await context.params
  if (!poolId || !pollId) {
    return NextResponse.json({ error: 'missing_ids' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const optionId = body.optionId?.trim()
  if (!optionId) {
    return NextResponse.json({ error: 'option_required' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()

  // Ensure poll belongs to this pool (defense in depth; RPC also validates).
  const { data: poll } = await admin
    .from('polls')
    .select('id, pool_id')
    .eq('id', pollId)
    .maybeSingle()
  if (!poll || poll.pool_id !== poolId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { error } = await admin.rpc('cast_poll_vote', {
    p_user_id: user.id,
    p_poll_id: pollId,
    p_option_id: optionId,
  })

  if (error) {
    console.error('cast_poll_vote failed:', error.message)
    const msg = error.message || 'vote_failed'
    if (msg.includes('not_a_member')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    if (msg.includes('poll_closed') || msg.includes('poll_not_available')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    if (msg.includes('invalid_option')) {
      return NextResponse.json({ error: 'invalid_option' }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
