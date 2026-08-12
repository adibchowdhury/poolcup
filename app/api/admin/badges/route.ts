import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/src/lib/admin-sync'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { achievementBadgeImageSrc } from '@/src/lib/achievement-badge-art'
import { searchUsers } from '@/src/lib/friendships'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const userId = url.searchParams.get('userId')?.trim() ?? ''

  const service = createAdminSupabaseClient()

  if (userId) {
    const [{ data: user }, { data: catalogue }, { data: earned }] =
      await Promise.all([
        service
          .from('users')
          .select('id, display_name, username, avatar, custom_avatar_url')
          .eq('id', userId)
          .maybeSingle(),
        service
          .from('achievements')
          .select(
            'id, name, description, rarity, xp_value, art_filename, is_active, list_order',
          )
          .order('list_order', { ascending: true, nullsFirst: false }),
        service
          .from('user_achievements')
          .select('achievement_id, earned_at')
          .eq('user_id', userId),
      ])

    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }

    const earnedAt = new Map(
      (earned ?? []).map((row) => [row.achievement_id, row.earned_at] as const),
    )

    return NextResponse.json({
      user,
      badges: (catalogue ?? []).map((badge) => ({
        ...badge,
        imageUrl: achievementBadgeImageSrc(badge.id, badge.art_filename),
        earned: earnedAt.has(badge.id),
        earned_at: earnedAt.get(badge.id) ?? null,
      })),
    })
  }

  if (q.length >= 2) {
    const { users, error } = await searchUsers(admin.supabase, q, 20)
    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }
    return NextResponse.json({ users })
  }

  return NextResponse.json({ error: 'missing_query' }, { status: 400 })
}
