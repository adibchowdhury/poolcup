import { NextResponse } from 'next/server'
import {
  CHAT_MESSAGE_MAX_LENGTH,
  validateChatMessage,
} from '@/src/lib/ugc-limits'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

type Body = {
  content?: string
}

/**
 * Member-gated pool chat send with server-side max length.
 * Inserts as the authenticated user (RLS still applies).
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

  const raw = typeof body.content === 'string' ? body.content : ''
  const validationError = validateChatMessage(raw)
  if (validationError) {
    return NextResponse.json(
      { error: validationError, maxLength: CHAT_MESSAGE_MAX_LENGTH },
      { status: 400 },
    )
  }

  const content = raw.trim()

  const { data: membership } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('pool_messages')
    .insert({
      pool_id: poolId,
      user_id: user.id,
      content,
    })
    .select(
      'id, pool_id, user_id, content, created_at, message_type, metadata',
    )
    .single()

  if (error) {
    console.error('pool message send failed:', error.message)
    const msg = error.message?.toLowerCase() ?? ''
    if (
      msg.includes('too fast') ||
      msg.includes('rate limit') ||
      msg.includes('too many')
    ) {
      return NextResponse.json(
        { error: 'You’re sending too fast. Wait a moment.' },
        { status: 429 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ message: data })
}
