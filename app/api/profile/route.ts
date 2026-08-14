import { NextResponse } from 'next/server'
import {
  DISPLAY_NAME_MAX_LENGTH,
  validateDisplayName,
} from '@/src/lib/ugc-limits'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  displayName?: string
}

/** Authenticated profile display_name update with server max-length. */
export async function PATCH(request: Request) {
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

  const raw = typeof body.displayName === 'string' ? body.displayName : ''
  const validationError = validateDisplayName(raw)
  if (validationError) {
    return NextResponse.json(
      { error: validationError, maxLength: DISPLAY_NAME_MAX_LENGTH },
      { status: 400 },
    )
  }

  const trimmed = raw.trim()
  const { error } = await supabase
    .from('users')
    .update({ display_name: trimmed })
    .eq('id', user.id)

  if (error) {
    console.error('profile display_name update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, displayName: trimmed })
}
