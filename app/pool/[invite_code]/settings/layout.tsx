import { Suspense } from 'react'
import { PoolSettingsAccessGate } from './render-pool-settings-route'
import { PoolSettingsChrome } from '@/components/pool/pool-settings-chrome'

export const runtime = 'nodejs'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ invite_code: string }>
}

export default async function PoolSettingsLayout({
  children,
  params,
}: LayoutProps) {
  const { invite_code: inviteCode } = await params

  return (
    <>
      <Suspense fallback={null}>
        <PoolSettingsAccessGate inviteCode={inviteCode} />
      </Suspense>
      <PoolSettingsChrome inviteCode={inviteCode}>{children}</PoolSettingsChrome>
    </>
  )
}
