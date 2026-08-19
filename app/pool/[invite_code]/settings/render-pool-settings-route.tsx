import { redirect } from 'next/navigation'
import { PoolSettingsPageView } from '@/components/pool/pool-settings-page-view'
import {
  assertPoolSettingsAccess,
  loadPoolSettingsPageData,
} from '@/src/lib/pool-settings-page-data'
import {
  normalizePoolSettingsSection,
  poolSettingsPath,
  type PoolSettingsSectionId,
} from '@/src/lib/pool-settings-nav'

function redirectAccessFailure(result: {
  kind: 'unauthenticated' | 'join' | 'ok'
  loginNext?: string
  inviteCode?: string
}): void {
  if (result.kind === 'unauthenticated' && result.loginNext) {
    redirect(result.loginNext)
  }
  if (result.kind === 'join' && result.inviteCode) {
    redirect(`/join/${encodeURIComponent(result.inviteCode)}`)
  }
}

/** Non-blocking membership check — wrap in Suspense from the layout. */
export async function PoolSettingsAccessGate({
  inviteCode,
}: {
  inviteCode: string
}) {
  const result = await assertPoolSettingsAccess(
    inviteCode,
    poolSettingsPath(inviteCode),
  )
  redirectAccessFailure(result)
  return null
}

export async function PoolSettingsSectionLoader({
  inviteCode,
  section,
}: {
  inviteCode: string
  section: PoolSettingsSectionId
}) {
  const result = await loadPoolSettingsPageData(
    inviteCode,
    poolSettingsPath(inviteCode, section),
  )
  redirectAccessFailure(result)
  if (result.kind !== 'ok') return null

  return (
    <PoolSettingsPageView initial={result.data} section={section} />
  )
}

export function redirectLegacySettingsQuery({
  inviteCode,
  section,
  querySection,
}: {
  inviteCode: string
  section: string | null
  querySection?: string | string[]
}) {
  const queryValue = Array.isArray(querySection)
    ? querySection[0]
    : querySection
  const queryNormalized = normalizePoolSettingsSection(queryValue)
  if (queryNormalized && !section) {
    redirect(poolSettingsPath(inviteCode, queryNormalized))
  }
}
