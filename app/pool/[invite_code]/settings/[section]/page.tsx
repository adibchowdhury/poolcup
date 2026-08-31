import { redirect } from 'next/navigation'
import {
  PoolSettingsSectionLoader,
  redirectLegacySettingsQuery,
} from '@/app/pool/[invite_code]/settings/render-pool-settings-route'
import {
  normalizePoolSettingsSection,
  poolSettingsPath,
} from '@/src/lib/pool-settings-nav'

export const runtime = 'nodejs'

type PageProps = {
  params: Promise<{ invite_code: string; section: string }>
  searchParams: Promise<{ section?: string | string[] }>
}

export default async function PoolSettingsSectionPage({
  params,
  searchParams,
}: PageProps) {
  const { invite_code: inviteCode, section: sectionParam } = await params
  const query = await searchParams

  redirectLegacySettingsQuery({
    inviteCode,
    section: sectionParam,
    querySection: query.section,
  })

  const normalized = normalizePoolSettingsSection(sectionParam)
  if (!normalized) {
    redirect(poolSettingsPath(inviteCode, 'details'))
  }

  return (
    <PoolSettingsSectionLoader inviteCode={inviteCode} section={normalized} />
  )
}
