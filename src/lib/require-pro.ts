import 'server-only'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

/** Standard Pro hard-gate 403 body used by analytics / history-performance. */
export const PRO_REQUIRED_BODY = {
  error: 'pro_required',
  isPro: false,
  locked: true,
} as const

/**
 * Soft Pro check via `user_has_pro`. Logs RPC failures and treats them as
 * non-Pro (same as previous inline call sites).
 */
export async function userHasPro(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_has_pro', {
    p_user_id: userId,
  })
  if (error) {
    console.error('user_has_pro failed:', error.message)
  }
  return data === true
}

/** Alias matching the assert* naming from the paywall plan. */
export const assertUserHasPro = userHasPro

export function proRequiredResponse(
  body: Record<string, unknown> = { ...PRO_REQUIRED_BODY },
  status = 403,
): NextResponse {
  return NextResponse.json(body, { status })
}

export type RequireProUserResult =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; response: NextResponse }

/**
 * Route guard: resolve the authed user and require Pro.
 * - Unauthenticated → 401 `{ error: 'unauthorized' }`
 * - Authenticated non-Pro → 403 with standard Pro payload (override via `forbiddenBody`)
 */
export async function requireProUser(options?: {
  forbiddenBody?: Record<string, unknown>
}): Promise<RequireProUserResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }

  const isPro = await userHasPro(supabase, user.id)
  if (!isPro) {
    return {
      ok: false,
      response: proRequiredResponse(
        options?.forbiddenBody ?? { ...PRO_REQUIRED_BODY },
      ),
    }
  }

  return { ok: true, supabase, userId: user.id }
}
