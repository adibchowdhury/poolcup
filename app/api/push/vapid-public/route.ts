import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/src/lib/push/vapid'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Public VAPID key for client subscribe (auth required). */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const publicKey = getVapidPublicKey()
  if (!publicKey) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  return NextResponse.json({ publicKey })
}
