import { redirect } from 'next/navigation'
import { poolSettingsTabPath } from '@/src/lib/pool-settings-nav'

export const runtime = 'nodejs'

type PageProps = {
  params: Promise<{ invite_code: string }>
  searchParams: Promise<{ section?: string | string[] }>
}

export default async function PoolSettingsHubRedirect({
  params,
  searchParams,
}: PageProps) {
  const { invite_code: inviteCode } = await params
  const query = await searchParams
  const section = Array.isArray(query.section) ? query.section[0] : query.section
  redirect(poolSettingsTabPath(inviteCode, section))
}
