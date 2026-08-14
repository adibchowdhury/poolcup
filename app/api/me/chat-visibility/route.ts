import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Authors whose pool-chat messages should be hidden for the current viewer:
 * - mutedUserIds: one-way mutes (viewer muted author)
 * - blockedPeerIds: either-direction blocks (mutual hide)
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()

  const [mutesRes, blocksAsActor, blocksAsTarget] = await Promise.all([
    admin
      .from('user_mutes')
      .select('muted_user_id')
      .eq('user_id', user.id),
    admin
      .from('user_blocks')
      .select('blocked_user_id')
      .eq('user_id', user.id),
    admin
      .from('user_blocks')
      .select('user_id')
      .eq('blocked_user_id', user.id),
  ])

  if (mutesRes.error) {
    console.error('chat-visibility mutes:', mutesRes.error.message)
  }
  if (blocksAsActor.error) {
    console.error('chat-visibility blocks actor:', blocksAsActor.error.message)
  }
  if (blocksAsTarget.error) {
    console.error('chat-visibility blocks target:', blocksAsTarget.error.message)
  }

  const mutedUserIds = [
    ...new Set(
      (mutesRes.data ?? [])
        .map((row) =>
          typeof row.muted_user_id === 'string' ? row.muted_user_id : null,
        )
        .filter(Boolean) as string[],
    ),
  ]

  const blockedPeerIds = [
    ...new Set(
      [
        ...(blocksAsActor.data ?? []).map((row) =>
          typeof row.blocked_user_id === 'string' ? row.blocked_user_id : null,
        ),
        ...(blocksAsTarget.data ?? []).map((row) =>
          typeof row.user_id === 'string' ? row.user_id : null,
        ),
      ].filter(Boolean) as string[],
    ),
  ]

  return NextResponse.json({ mutedUserIds, blockedPeerIds })
}
