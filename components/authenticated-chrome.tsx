'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  ReportIssueProvider,
  useReportIssue,
} from '@/components/report-issue-dialog'
import { cn } from '@/lib/utils'
import { useAuth } from '@/src/lib/auth-context'
import {
  hasAuthenticatedBottomBar,
  isAuthenticatedAppPath,
} from '@/src/lib/authenticated-paths'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'

function ReportIssueFab({ className }: { className?: string }) {
  const { openReportIssue } = useReportIssue()

  return (
    <button
      type="button"
      onClick={openReportIssue}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-md transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-2 sm:px-3 sm:py-2 sm:text-sm',
        className,
      )}
      aria-label="Report an issue"
    >
      <Image
        src="/bug-icon.png"
        alt=""
        width={256}
        height={192}
        className="h-[22px] w-auto shrink-0"
        aria-hidden
      />
      <span className="max-[360px]:sr-only">Report issue</span>
    </button>
  )
}

function AuthenticatedChromeContent() {
  const pathname = usePathname() ?? ''
  const { mobileChatActive } = useMobileChatChrome()
  const bottomOffset = hasAuthenticatedBottomBar(pathname)
    ? 'bottom-20 sm:bottom-24'
    : 'bottom-4 sm:bottom-6'

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <div
        className={cn(
          'pointer-events-auto absolute right-4',
          bottomOffset,
          mobileChatActive && 'max-sm:hidden',
        )}
      >
        <ReportIssueFab />
      </div>
    </div>
  )
}

export function AuthenticatedChrome() {
  const { user, loading } = useAuth()
  const pathname = usePathname() ?? ''

  if (loading || !user || !isAuthenticatedAppPath(pathname)) {
    return null
  }

  return (
    <ReportIssueProvider>
      <AuthenticatedChromeContent />
    </ReportIssueProvider>
  )
}
