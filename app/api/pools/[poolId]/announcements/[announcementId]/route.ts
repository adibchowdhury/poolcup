import { NextResponse } from 'next/server'
import {
  fetchIsPoolAdmin,
  logPoolModeration,
} from '@/src/lib/pool-admin'
import {
  ANNOUNCEMENT_MAX_LENGTH,
  parseAnnouncementRow,
} from '@/src/lib/pool-announcements'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string; announcementId: string }> }

type PatchBody = {
  message?: string
  pinned?: boolean
  isActive?: boolean
}

/**
 * Admin mutations: edit message, pin/unpin (RPC), soft-delete.
 */
export async function PATCH(request: Request, context: Ctx) {
  const { poolId, announcementId } = await context.params
  if (!poolId || !announcementId) {
    return NextResponse.json({ error: 'missing_ids' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const isAdmin = await fetchIsPoolAdmin(admin, poolId, user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: existing, error: existingError } = await admin
    .from('pool_announcements')
    .select('id, pool_id, message, author_id, created_at, updated_at, pinned, is_active')
    .eq('id', announcementId)
    .eq('pool_id', poolId)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (typeof body.pinned === 'boolean') {
    const { error: pinError } = await admin.rpc('set_announcement_pinned', {
      p_actor_id: user.id,
      p_announcement_id: announcementId,
      p_pinned: body.pinned,
    })
    if (pinError) {
      console.error('set_announcement_pinned failed:', pinError.message)
      return NextResponse.json(
        { error: pinError.message || 'pin_failed' },
        { status: 500 },
      )
    }
    const { data: afterPin } = await admin
      .from('pool_announcements')
      .select(
        'id, message, author_id, created_at, updated_at, pinned, is_active',
      )
      .eq('id', announcementId)
      .maybeSingle()
    return NextResponse.json({
      success: true,
      action: body.pinned ? 'pinned' : 'unpinned',
      announcement: parseAnnouncementRow(afterPin),
    })
  }

  if (body.isActive === false) {
    const { error: clearError } = await admin
      .from('pool_announcements')
      .update({ is_active: false, pinned: false })
      .eq('id', announcementId)
      .eq('pool_id', poolId)

    if (clearError) {
      console.error('soft-delete announcement failed:', clearError.message)
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
    }

    await logPoolModeration(admin, {
      poolId,
      actorId: user.id,
      action: 'announcement_deleted',
      detail: { announcement_id: announcementId },
    })

    return NextResponse.json({ success: true, action: 'deleted' })
  }

  if (typeof body.message === 'string') {
    const trimmed = body.message.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'message_required' }, { status: 400 })
    }
    if (trimmed.length > ANNOUNCEMENT_MAX_LENGTH) {
      return NextResponse.json({ error: 'message_too_long' }, { status: 400 })
    }
    if (!existing.is_active) {
      return NextResponse.json({ error: 'inactive' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await admin
      .from('pool_announcements')
      .update({ message: trimmed })
      .eq('id', announcementId)
      .eq('pool_id', poolId)
      .select(
        'id, message, author_id, created_at, updated_at, pinned, is_active',
      )
      .maybeSingle()

    if (updateError || !updated) {
      console.error('edit announcement failed:', updateError?.message)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    await logPoolModeration(admin, {
      poolId,
      actorId: user.id,
      action: 'announcement_edited',
      detail: { announcement_id: announcementId },
    })

    return NextResponse.json({
      success: true,
      action: 'edited',
      announcement: parseAnnouncementRow(updated),
    })
  }

  return NextResponse.json({ error: 'no_changes' }, { status: 400 })
}
