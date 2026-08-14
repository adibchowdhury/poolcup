import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SuspendedAccountView } from '@/components/auth/suspended-account-view'
import { SUSPENDED_COOKIE } from '@/src/lib/account-suspended'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Account suspended | PoolCup',
  robots: { index: false, follow: false },
}

export default async function SuspendedPage() {
  // Allowed with suspended cookie (post sign-out) or while still banned mid-sign-out.
  const cookieStore = await cookies()
  const hasSuspendedCookie =
    cookieStore.get(SUSPENDED_COOKIE)?.value === '1'

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let banned = false
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('banned')
      .eq('id', user.id)
      .maybeSingle()
    banned = profile?.banned === true
  }

  if (!hasSuspendedCookie && !banned) {
    redirect(user ? '/dashboard' : '/login')
  }

  return <SuspendedAccountView />
}
