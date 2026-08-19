import { cn } from '@/lib/utils'

export type DashboardWelcomeNameSource = 'displayName' | 'username' | 'fallback'

export function resolveDashboardWelcomeName(
  displayName?: string | null,
  username?: string | null,
): { name: string; source: DashboardWelcomeNameSource } {
  const firstFromDisplay = displayName?.trim().split(/\s+/).filter(Boolean)[0]
  if (firstFromDisplay) {
    return { name: firstFromDisplay, source: 'displayName' }
  }

  const fromUsername = username?.trim()
  if (fromUsername) {
    return { name: fromUsername, source: 'username' }
  }

  return { name: 'Player', source: 'fallback' }
}

type DashboardHomeWelcomeProps = {
  displayName?: string | null
  username?: string | null
  className?: string
}

export function DashboardHomeWelcome({
  displayName,
  username,
  className,
}: DashboardHomeWelcomeProps) {
  const { name } = resolveDashboardWelcomeName(displayName, username)

  return (
    <header className={cn('min-w-0', className)}>
      <h2 className="font-display text-3xl leading-tight tracking-wide text-foreground xl:text-4xl">
        Welcome back, {name}!
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
        Make your picks, track your pools, and climb the standings.
      </p>
    </header>
  )
}
