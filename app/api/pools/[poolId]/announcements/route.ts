import { NextResponse } from 'next/server'
import {
  fetchIsPoolAdmin,
  logPoolModeration,
} from '@/src/lib/pool-admin'
import {
  ANNOUNCEMENT_MAX_LENGTH,
  parseAnnouncementRow,
  sortAnnouncements,
  type PoolAnnouncement,
} from '@/src/lib/pool-announcements'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

/**
 * Member-visible active announcements + banner candidate
 * (pinned first among undismissed; else latest undismissed).
 */
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

  const { data: membership, error: membershipError } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('announcements GET membership:', membershipError.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('pool_announcements')
    .select('id, message, author_id, created_at, updated_at, pinned, is_active')
    .eq('pool_id', poolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('announcements GET failed:', error.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  const rawRows = (data ?? []) as Record<string, unknown>[]
  const authorIds = [
    ...new Set(
      rawRows
        .map((r) =>
          typeof r.author_id === 'string' ? r.author_id : null,
        )
        .filter(Boolean) as string[],
    ),
  ]

  const nameById = new Map<string, string>()
  if (authorIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, display_name, username')
      .in('id', authorIds)
    for (const u of users ?? []) {
      const name =
        (typeof u.display_name === 'string' && u.display_name.trim()) ||
        (typeof u.username === 'string' && u.username.trim()) ||
        'Commissioner'
      nameById.set(String(u.id), name)
    }
  }

  const rows: PoolAnnouncement[] = sortAnnouncements(
    rawRows
      .map((row) => {
        const parsed = parseAnnouncementRow(row)
        if (!parsed) return null
        return {
          ...parsed,
          authorName: nameById.get(parsed.authorId) ?? null,
        }
      })
      .filter(Boolean) as PoolAnnouncement[],
  )

  const ids = rows.map((r) => r.id)
  const dismissed = new Set<string>()
  if (ids.length > 0) {
    const { data: dismissals } = await admin
      .from('announcement_dismissals')
      .select('announcement_id')
      .eq('user_id', user.id)
      .in('announcement_id', ids)
    for (const d of dismissals ?? []) {
      if (typeof d.announcement_id === 'string') {
        dismissed.add(d.announcement_id)
      }
    }
  }

  const undismissed = rows.filter((r) => !dismissed.has(r.id))
  const pinned = undismissed.find((r) => r.pinned)
  const banner = pinned ?? undismissed[0] ?? null

  return NextResponse.json({ rows, banner })
}

type CreateBody = {
  message?: string
}

/** Admin-gated announcement create with server max-length. */
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

  const raw = typeof body.message === 'string' ? body.message : ''
  const trimmed = raw.trim()
  if (!trimmed) {
    return NextResponse.json({ error: 'Write a message first' }, { status: 400 })
  }
  if (trimmed.length > ANNOUNCEMENT_MAX_LENGTH) {
    return NextResponse.json(
      {
        error: `Keep it under ${ANNOUNCEMENT_MAX_LENGTH} characters`,
      },
      { status: 400 },
    )
  }

  const admin = createAdminSupabaseClient()
  const isAdmin = await fetchIsPoolAdmin(admin, poolId, user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('pool_announcements')
    .insert({
      pool_id: poolId,
      author_id: user.id,
      message: trimmed,
      is_active: true,
      pinned: false,
    })
    .select('id, message, author_id, created_at, updated_at, pinned, is_active')
    .single()

  if (error || !data) {
    console.error('announcement create failed:', error?.message)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to post announcement' },
      { status: 500 },
    )
  }

  await logPoolModeration(admin, {
    poolId,
    actorId: user.id,
    action: 'announcement_posted',
    detail: { announcement_id: data.id },
  }).catch(() => {})

  return NextResponse.json({
    success: true,
    announcement: parseAnnouncementRow(data),
  })
}
