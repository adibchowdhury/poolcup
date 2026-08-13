import { NextResponse } from 'next/server'
import { fetchIsPoolAdmin } from '@/src/lib/pool-admin'
import {
  parsePoolPoll,
  validatePollComposer,
  type PoolPoll,
} from '@/src/lib/pool-polls'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

/** Member-gated list via get_pool_polls. */
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
  const { data, error } = await admin.rpc('get_pool_polls', {
    p_user_id: user.id,
    p_pool_id: poolId,
  })

  if (error) {
    console.error('get_pool_polls failed:', error.message)
    const msg = error.message || 'load_failed'
    if (msg.includes('not_a_member')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  const polls = (Array.isArray(data) ? data : [])
    .map((row) => parsePoolPoll(row))
    .filter(Boolean) as PoolPoll[]

  return NextResponse.json({ polls })
}

type CreateBody = {
  question?: string
  options?: string[]
  closesAt?: string | null
}

/** Admin-gated create via create_poll. */
export async function POST(request: Request, context: Ctx) {
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

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const validated = validatePollComposer({
    question: typeof body.question === 'string' ? body.question : '',
    options: Array.isArray(body.options)
      ? body.options.map((o) => String(o ?? ''))
      : [],
  })
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  let closesAt: string | null = null
  if (body.closesAt != null && String(body.closesAt).trim()) {
    const parsed = new Date(String(body.closesAt))
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'invalid_closes_at' }, { status: 400 })
    }
    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'closes_at_must_be_future' },
        { status: 400 },
      )
    }
    closesAt = parsed.toISOString()
  }

  const admin = createAdminSupabaseClient()
  const isAdmin = await fetchIsPoolAdmin(admin, poolId, user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await admin.rpc('create_poll', {
    p_actor_id: user.id,
    p_pool_id: poolId,
    p_question: validated.question,
    p_options: validated.options,
    p_closes_at: closesAt,
  })

  if (error) {
    console.error('create_poll failed:', error.message)
    return NextResponse.json(
      { error: error.message || 'create_failed' },
      { status: 500 },
    )
  }

  const pollId = typeof data === 'string' ? data : String(data ?? '')
  if (!pollId) {
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, pollId })
}
