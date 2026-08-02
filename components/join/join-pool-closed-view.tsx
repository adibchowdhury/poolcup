import Link from 'next/link'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

type JoinPoolClosedViewProps = {
  poolName: string
  isLoggedIn?: boolean
}

export function JoinPoolClosedView({
  poolName,
  isLoggedIn = false,
}: JoinPoolClosedViewProps) {
  return (
    <main
      className={cn(
        'flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <PoolCupLogo />
          </div>
          <p className="mt-1 text-sm text-[#5a7080]">
            World Cup 2026 Prediction Pools
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#1e2d3d] bg-[#111a27] shadow-xl">
          <div className="border-b border-[#1e2d3d] bg-gradient-to-br from-amber-500/15 to-[#111a27] p-6">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1">
              <span className="text-xs font-medium text-amber-400">
                Not accepting members
              </span>
            </div>
            <h1 className="font-display text-2xl tracking-wide text-[#f0f4f8] sm:text-3xl">
              {poolName}
            </h1>
          </div>

          <div className="space-y-6 p-6">
            <p className="text-center text-sm leading-relaxed text-[#5a7080]">
              <span className="font-medium text-[#f0f4f8]">{poolName}</span> is
              not accepting new members right now. Ask the captain to reopen
              invites if you still want to join.
            </p>

            <div className="flex flex-col gap-3">
              <Link
                href="/create"
                className="flex w-full items-center justify-center rounded-lg bg-[#00e676] px-5 py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90"
              >
                Create your own pool
              </Link>
              <Link
                href={isLoggedIn ? '/dashboard' : '/'}
                className="flex w-full items-center justify-center rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-5 py-3 text-sm font-medium text-[#f0f4f8] transition-colors hover:border-[#00e676]/40 hover:bg-[#1a2535]"
              >
                {isLoggedIn ? 'Back to dashboard' : 'Go home'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
