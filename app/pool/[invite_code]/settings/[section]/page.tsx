import { redirect } from 'next/navigation'
import { poolSettingsTabPath } from '@/src/lib/pool-settings-nav'

export const runtime = 'nodejs'

type PageProps = {
  params: Promise<{ invite_code: string; section: string }>
}

export default async function PoolSettingsSectionRedirect({ params }: PageProps) {
  const { invite_code: inviteCode, section } = await params
  redirect(poolSettingsTabPath(inviteCode, section))
}
