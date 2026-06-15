'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/src/lib/auth'
import { Button } from '@/components/ui/button'

export function useDashboardSignOut(onAfterClick?: () => void) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSignOut = useCallback(async () => {
    setLoading(true)
    onAfterClick?.()
    await signOut()
    router.push('/')
  }, [onAfterClick, router])

  return { handleSignOut, loading }
}

export function DashboardSignOut({
  displayName,
  menuItem = false,
  onAfterClick,
}: {
  displayName?: string | null
  menuItem?: boolean
  onAfterClick?: () => void
}) {
  const { handleSignOut, loading } = useDashboardSignOut(onAfterClick)

  if (menuItem) {
    return (
      <Button
        type="button"
        variant="ghost"
        role="menuitem"
        onClick={() => void handleSignOut()}
        disabled={loading}
        className="w-full justify-start text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {displayName?.trim() && (
        <span className="hidden max-w-[200px] truncate text-sm text-muted-foreground sm:inline">
          {displayName.trim()}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handleSignOut()}
        disabled={loading}
        className="text-muted-foreground hover:text-foreground"
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  )
}
