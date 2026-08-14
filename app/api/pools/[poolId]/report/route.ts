import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

type Body = {
  reason?: string
  context?: string | null
}

/**
 * Authenticated pool report → report_pool(reporter, pool, reason, context).
 * Members or anyone who can view the pool may report (API only requires auth).
 */
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

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!reason) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 })
  }

  const contextText =
    typeof body.context === 'string' && body.context.trim()
      ? body.context.trim().slice(0, 1000)
      : null

  // Prefer the caller's JWT so auth.uid() matches; fall back to service role RPC.
  const { error } = await supabase.rpc('report_pool', {
    p_reporter_id: user.id,
    p_pool_id: poolId,
    p_reason: reason.slice(0, 500),
    p_context: contextText,
  })

  if (error) {
    const msg = error.message?.toLowerCase() ?? ''
    if (msg.includes('already_reported')) {
      return NextResponse.json({ error: 'already_reported' }, { status: 409 })
    }
    if (msg.includes('user_banned')) {
      return NextResponse.json({ error: 'user_banned' }, { status: 403 })
    }
    if (msg.includes('not_authenticated')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    if (msg.includes('reason_required')) {
      return NextResponse.json({ error: 'reason_required' }, { status: 400 })
    }

    // Some deployments only grant service_role — retry once.
    try {
      const admin = createAdminSupabaseClient()
      const { error: adminError } = await admin.rpc('report_pool', {
        p_reporter_id: user.id,
        p_pool_id: poolId,
        p_reason: reason.slice(0, 500),
        p_context: contextText,
      })
      if (adminError) {
        const adminMsg = adminError.message?.toLowerCase() ?? ''
        if (adminMsg.includes('already_reported')) {
          return NextResponse.json({ error: 'already_reported' }, { status: 409 })
        }
        if (adminMsg.includes('user_banned')) {
          return NextResponse.json({ error: 'user_banned' }, { status: 403 })
        }
        console.error('report_pool failed:', adminError.message)
        return NextResponse.json(
          { error: adminError.message },
          { status: 400 },
        )
      }
      return NextResponse.json({ success: true })
    } catch (retryErr) {
      console.error('report_pool retry failed:', retryErr)
      console.error('report_pool failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}
