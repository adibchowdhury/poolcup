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
 * Current user's accent theme.
 * Phase 2: accent themes are free — isPro kept true for caller compat.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

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
    isPro: true,
    accentTheme: parseAccentTheme(row?.accent_theme),
  })
}

type PatchBody = {
  accentTheme?: string | null
}

/**
 * Persist accent_theme. Phase 2: available to all authenticated users.
 * Value must be a known preset key or null (reset to default green).
 * Payload preserves prior shape (no `locked` field).
 */
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const userId = user.id

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
    .eq('id', userId)

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
