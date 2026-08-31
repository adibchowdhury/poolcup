import { PoolUpgradePageView } from '@/components/pool/pool-upgrade-page-view'
import {
  assertPoolSettingsAccess,
  loadPoolSettingsPageData,
} from '@/src/lib/pool-settings-page-data'
import { poolUpgradePath } from '@/src/lib/pool-settings-nav'
import { redirect } from 'next/navigation'

export const runtime = 'nodejs'

type PageProps = {
  params: Promise<{ invite_code: string }>
}

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

export default async function PoolUpgradePage({ params }: PageProps) {
  const { invite_code: inviteCode } = await params
  const access = await assertPoolSettingsAccess(
    inviteCode,
    poolUpgradePath(inviteCode),
  )
  redirectAccessFailure(access)

  const result = await loadPoolSettingsPageData(
    inviteCode,
    poolUpgradePath(inviteCode),
  )
  redirectAccessFailure(result)
  if (result.kind !== 'ok') return null

  return <PoolUpgradePageView initial={result.data} />
}
