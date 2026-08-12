import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { sendPushToUser } from '@/src/lib/push/send-push'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const result = await sendPushToUser(
    admin,
    user.id,
    {
      title: 'PoolCup test',
      body: "Push is working. You're all set.",
      data: { href: '/settings/notifications' },
      category: 'test',
    },
    'push-test',
  )

  if (result.sent === 0) {
    return NextResponse.json(
      {
        error: 'no_subscription',
        message: 'No active push subscription for this device.',
        ...result,
      },
      { status: 400 },
    )
  }

  return NextResponse.json({ success: true, ...result })
}
