'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/src/lib/auth'
import { Button } from '@/components/ui/button'

export function DashboardSignOut({ email }: { email: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex items-center gap-3">
      {email && (
        <span className="hidden max-w-[200px] truncate text-sm text-muted-foreground sm:inline">
          {email}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        disabled={loading}
        className="text-muted-foreground hover:text-foreground"
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  )
}
