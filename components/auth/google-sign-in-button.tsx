'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { GoogleIcon } from '@/components/auth/google-icon'
import { signInWithGoogle } from '@/src/lib/auth'

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleSignIn() {
    setError(null)
    setLoading(true)

    const { error: authError } = await signInWithGoogle()

    if (authError) {
      setLoading(false)
      setError(authError.message)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#1e2d3d] bg-white px-4 py-3 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#5a7080]" aria-hidden />
        ) : (
          <GoogleIcon className="h-5 w-5 shrink-0" />
        )}
        {loading ? 'Redirecting…' : 'Continue with Google'}
      </button>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
