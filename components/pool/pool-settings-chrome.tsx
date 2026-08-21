'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ReportIssueButton } from '@/components/report-issue-dialog'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  poolPagePath,
  poolSettingsPath,
} from '@/src/lib/pool-settings-nav'

type PoolSettingsChromeProps = {
  inviteCode: string
  children: React.ReactNode
}

export function PoolSettingsChrome({
  inviteCode,
  children,
}: PoolSettingsChromeProps) {
  const pathname = usePathname()
  const router = useRouter()
  const onSection = /\/settings\/(details|scoring|members|communication|commissioner|danger)\/?$/.test(
    pathname,
  )

  const backHref = onSection
    ? poolSettingsPath(inviteCode)
    : poolPagePath(inviteCode)
  const backLabel = onSection ? 'Back to settings' : 'Back to pool'

  useEffect(() => {
    router.prefetch(poolPagePath(inviteCode))
    router.prefetch(poolSettingsPath(inviteCode))
  }, [inviteCode, router])

  return (
    <div className="min-h-screen bg-app-background">
      <header className="sticky top-0 z-[100] isolate border-b border-border bg-app-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={backHref}
            prefetch
            aria-label={backLabel}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              FOCUS_VISIBLE_RING,
            )}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <ReportIssueButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
