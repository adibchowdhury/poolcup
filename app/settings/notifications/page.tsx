import { redirect } from 'next/navigation'
import { NotificationPreferencesView } from '@/components/settings/notification-preferences-view'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Notification settings | PoolCup',
  robots: { index: false, follow: false },
}

export default async function NotificationSettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <NotificationPreferencesView />
}
