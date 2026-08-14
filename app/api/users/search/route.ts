import { NextResponse } from 'next/server'
import {
  coerceUserSearchRow,
  type UserSearchRow,
} from '@/src/lib/friendships'
import {
  checkDbRateLimit,
  USER_SEARCH_MAX,
  USER_SEARCH_RATE_LIMIT_MESSAGE,
  USER_SEARCH_WINDOW_SEC,
} from '@/src/lib/rate-limit'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

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

  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim()
  const limitRaw = Number(params.get('limit') ?? '20')
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 50)
    : 20

  if (q.length < 2) {
    return NextResponse.json({ users: [] as UserSearchRow[] })
  }

  const admin = createAdminSupabaseClient()
  const allowed = await checkDbRateLimit(admin, {
    action: 'user_search',
    subject: `user:${user.id}`,
    max: USER_SEARCH_MAX,
    windowSeconds: USER_SEARCH_WINDOW_SEC,
  })

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: USER_SEARCH_RATE_LIMIT_MESSAGE,
        users: [],
      },
      { status: 429 },
    )
  }

  // search_users is SECURITY DEFINER and keys off auth.uid() — call as the user.
  const { data, error } = await supabase.rpc('search_users', {
    p_query: q,
    p_limit: limit,
  })

  if (error) {
    console.error('search_users failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = Array.isArray(data) ? data : []
  const users = rows
    .map(coerceUserSearchRow)
    .filter((row): row is UserSearchRow => row != null)

  return NextResponse.json({ users })
}
