import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { awardActionXp, utcDateStamp } from '@/src/lib/xp-award-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const admin = createAdminSupabaseClient()
    const result = await awardActionXp(admin, {
      userId: user.id,
      sourceType: 'daily_active',
      sourceId: utcDateStamp(),
      description: 'Daily active',
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('xp/heartbeat failed', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
