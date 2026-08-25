import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ draftId: string }> }

/**
 * Owner-only draft status for post-checkout finalizing poll.
 */
export async function GET(_request: Request, context: Ctx) {
  const { draftId } = await context.params
  if (!draftId) {
    return NextResponse.json({ error: 'draftId_required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const { data: draft, error } = await admin
    .from('pool_creation_drafts')
    .select('id, user_id, consumed_at, created_pool_id, payload')
    .eq('id', draftId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!draft || draft.user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (!draft.consumed_at || !draft.created_pool_id) {
    return NextResponse.json({
      status: 'pending' as const,
      draftId: draft.id,
      createdPoolId: null,
      inviteCode: null,
      name: null,
    })
  }

  const { data: pool } = await admin
    .from('pools')
    .select('id, name, invite_code')
    .eq('id', draft.created_pool_id)
    .maybeSingle()

  return NextResponse.json({
    status: 'ready' as const,
    draftId: draft.id,
    createdPoolId: draft.created_pool_id,
    inviteCode:
      typeof pool?.invite_code === 'string' ? pool.invite_code : null,
    name: typeof pool?.name === 'string' ? pool.name : null,
    hasPendingEmblem: Boolean(
      (draft.payload as { hasPendingEmblem?: boolean } | null)
        ?.hasPendingEmblem,
    ),
  })
}
