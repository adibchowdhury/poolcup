import { redirect } from 'next/navigation'
import { poolSettingsPath } from '@/src/lib/pool-settings-nav'

export const runtime = 'nodejs'

type PageProps = {
  params: Promise<{ invite_code: string }>
  searchParams: Promise<{ section?: string | string[] }>
}

export default async function PoolSettingsHubPage({
  params,
  searchParams,
}: PageProps) {
  const { invite_code: inviteCode } = await params
  const query = await searchParams
  const section = Array.isArray(query.section) ? query.section[0] : query.section
  redirect(poolSettingsPath(inviteCode, section ?? 'details'))
}
