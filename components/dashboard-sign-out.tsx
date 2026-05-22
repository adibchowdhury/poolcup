'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/src/lib/auth'

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
        <span className="hidden max-w-[180px] truncate text-xs text-[#5a7080] sm:inline">
          {email}
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className="rounded-lg border border-[#1e2d3d] px-4 py-2.5 text-sm text-[#5a7080] hover:text-[#f0f4f8] hover:border-[rgba(255,255,255,0.15)] disabled:opacity-50 transition-colors"
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}
