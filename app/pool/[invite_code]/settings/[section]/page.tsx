import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { PoolSettingsSectionLoader } from '../render-pool-settings-route'
import { PoolSettingsSectionSkeleton } from '@/components/pool/pool-settings-skeletons'
import {
  normalizePoolSettingsSection,
  poolSettingsPath,
} from '@/src/lib/pool-settings-nav'

export const runtime = 'nodejs'

type PageProps = {
  params: Promise<{ invite_code: string; section: string }>
}

export const metadata: Metadata = {
  title: 'Pool settings · PoolCup',
  robots: { index: false, follow: false },
}

export default async function PoolSettingsSectionPage({ params }: PageProps) {
  const { invite_code: inviteCode, section } = await params
  const routeSection = normalizePoolSettingsSection(section)
  if (!routeSection) {
    redirect(poolSettingsPath(inviteCode))
  }

  return (
    <Suspense fallback={<PoolSettingsSectionSkeleton />}>
      <PoolSettingsSectionLoader
        inviteCode={inviteCode}
        section={routeSection}
      />
    </Suspense>
  )
}
