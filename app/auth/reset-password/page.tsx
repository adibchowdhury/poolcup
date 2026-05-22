'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'

const inputClassName =
  'w-full rounded-lg bg-[#080b0f] border border-[#1e2d3d] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:outline-none focus:ring-2 focus:ring-[#00e676]/50 focus:border-[#00e676]'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session) {
        setReady(true)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/dashboard?passwordReset=success')
  }

  return (
    <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-[#111a27] border border-[#1e2d3d] p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight text-[#f0f4f8]">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-[#5a7080]">
          Choose a new password for your account.
        </p>

        {!ready ? (
          <p className="mt-8 text-sm text-[#5a7080]">
            Verifying reset link…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-[#5a7080] mb-2"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="confirm-new-password"
                className="block text-sm font-medium text-[#5a7080] mb-2"
              >
                Confirm new password
              </label>
              <input
                id="confirm-new-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className={inputClassName}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[#5a7080]">
          <a href="/login" className="text-[#00e676] hover:underline font-medium">
            Back to sign in
          </a>
        </p>
      </div>
    </main>
  )
}
