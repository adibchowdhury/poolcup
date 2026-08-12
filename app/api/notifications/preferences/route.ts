import { NextResponse } from 'next/server'
import {
  NOTIFICATION_CATEGORIES,
  isNotificationCategory,
  type NotificationCategory,
} from '@/src/lib/notifications'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function defaults(): Record<NotificationCategory, boolean> {
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((c) => [c, true]),
  ) as Record<NotificationCategory, boolean>
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const prefs = defaults()
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('category, enabled')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const row of data ?? []) {
    const cat = String(row.category ?? '')
    if (isNotificationCategory(cat)) {
      prefs[cat] = row.enabled !== false
    }
  }

  return NextResponse.json({ prefs })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { category?: string; enabled?: boolean }
  try {
    body = (await request.json()) as { category?: string; enabled?: boolean }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const category = body.category?.trim() ?? ''
  if (!isNotificationCategory(category)) {
    return NextResponse.json({ error: 'invalid_category' }, { status: 400 })
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'invalid_enabled' }, { status: 400 })
  }

  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: user.id,
      category,
      enabled: body.enabled,
    },
    { onConflict: 'user_id,category' },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, category, enabled: body.enabled })
}
