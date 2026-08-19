import type { Metadata } from 'next'
import { PoolSettingsHubList } from '@/components/pool/pool-settings-hub-list'
import { redirectLegacySettingsQuery } from './render-pool-settings-route'

export const runtime = 'nodejs'

type PageProps = {
  params: Promise<{ invite_code: string }>
  searchParams: Promise<{ section?: string | string[] }>
}

export const metadata: Metadata = {
  title: 'Pool settings · PoolCup',
  robots: { index: false, follow: false },
}

export default async function PoolSettingsHubPage({
  params,
  searchParams,
}: PageProps) {
  const { invite_code: inviteCode } = await params
  const query = await searchParams
  redirectLegacySettingsQuery({
    inviteCode,
    section: null,
    querySection: query.section,
  })

  return <PoolSettingsHubList inviteCode={inviteCode} />
}
