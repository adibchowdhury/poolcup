import { NextResponse } from 'next/server'
import { loadUserBillingSnapshot } from '@/src/lib/billing-snapshot'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Authed user's billing snapshot for the billing settings page. */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const snapshot = await loadUserBillingSnapshot(user.id)
  if (!snapshot) {
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  return NextResponse.json({ billing: snapshot })
}
