import { NextResponse } from 'next/server'
import {
  isAccentThemeKey,
  parseAccentTheme,
  type AccentThemeKey,
} from '@/src/lib/accent-theme'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Current user's accent theme + Pro entitlement.
 * Free users still receive stored accent_theme (for UI), but isPro=false
 * so the client must not apply it.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: isProRaw, error: proError } = await supabase.rpc(
    'user_has_pro',
    { p_user_id: user.id },
  )
  if (proError) {
    console.error('user_has_pro failed:', proError.message)
  }
  const isPro = isProRaw === true

  const { data: row, error } = await supabase
    .from('users')
    .select('accent_theme')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('accent_theme load failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    isPro,
    accentTheme: parseAccentTheme(row?.accent_theme),
  })
}

type PatchBody = {
  accentTheme?: string | null
}

/**
 * Persist accent_theme. Pro-gated: free users get 403; value must be a
 * known preset key or null (reset to default green).
 */
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: isProRaw, error: proError } = await supabase.rpc(
    'user_has_pro',
    { p_user_id: user.id },
  )
  if (proError) {
    console.error('user_has_pro failed:', proError.message)
  }
  const isPro = isProRaw === true

  if (!isPro) {
    return NextResponse.json(
      { error: 'pro_required', isPro: false },
      { status: 403 },
    )
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const raw = body.accentTheme
  let next: AccentThemeKey | null
  if (raw === null || raw === undefined || raw === '' || raw === 'default') {
    next = null
  } else if (isAccentThemeKey(raw)) {
    next = raw
  } else {
    return NextResponse.json(
      { error: 'invalid_accent_theme' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('users')
    .update({ accent_theme: next })
    .eq('id', user.id)

  if (error) {
    console.error('accent_theme update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    isPro: true,
    accentTheme: next,
  })
}
