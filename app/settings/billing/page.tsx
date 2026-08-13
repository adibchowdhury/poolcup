import { redirect } from 'next/navigation'
import { BillingSettingsView } from '@/components/settings/billing-settings-view'
import { loadUserBillingSnapshot } from '@/src/lib/billing-snapshot'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Billing | PoolCup',
  robots: { index: false, follow: false },
}

type PageProps = {
  searchParams: Promise<{ status?: string }>
}

export default async function BillingSettingsPage({ searchParams }: PageProps) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/settings/billing')
  }

  const snapshot = await loadUserBillingSnapshot(user.id)
  if (!snapshot) {
    redirect('/login?next=/settings/billing')
  }

  const params = await searchParams
  const status =
    params.status === 'success' || params.status === 'cancel'
      ? params.status
      : null

  return (
    <BillingSettingsView initial={snapshot} checkoutStatus={status} />
  )
}
