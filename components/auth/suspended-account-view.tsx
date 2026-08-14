import Link from 'next/link'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

export function SuspendedAccountView() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <PoolCupLogo href="/" className="h-10 w-auto" />
        </div>
        <div className="space-y-3">
          <h1 className="font-display text-3xl tracking-wide text-foreground">
            Account suspended
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your account has been suspended. Contact{' '}
            <a
              href="mailto:support@getpoolcup.com"
              className={cn(
                'rounded-sm font-medium text-primary underline-offset-4 hover:underline',
                FOCUS_VISIBLE_RING,
              )}
            >
              support@getpoolcup.com
            </a>
            .
          </p>
        </div>
        <p>
          <Link
            href="/"
            className={cn(
              'rounded-md text-sm text-muted-foreground hover:text-foreground',
              FOCUS_VISIBLE_RING,
            )}
          >
            Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
