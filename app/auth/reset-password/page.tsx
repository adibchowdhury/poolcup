'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'

const inputClassName =
  'w-full rounded-lg bg-[#080b0f] border border-[#1e2d3d] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:outline-none focus:ring-2 focus:ring-[#00e676]/50 focus:border-[#00e676]'

const RECOVERY_TIMEOUT_MS = 5000

function isRecoveryHash(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  return (
    hash.includes('type=recovery') ||
    hash.includes('type=password_recovery')
  )
}

type PageState = 'loading' | 'ready' | 'expired'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let recoveryConfirmed = false

    const confirmRecovery = () => {
      if (!mounted || recoveryConfirmed) return
      recoveryConfirmed = true
      setPageState('ready')
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        confirmRecovery()
        return
      }

      if (
        session &&
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') &&
        isRecoveryHash()
      ) {
        confirmRecovery()
      }
    })

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!mounted || recoveryConfirmed) return

      if (session && isRecoveryHash()) {
        confirmRecovery()
      }
    }

    checkSession()

    const timeout = setTimeout(() => {
      if (!mounted || recoveryConfirmed) return
      setPageState('expired')
    }, RECOVERY_TIMEOUT_MS)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-[#111a27] border border-[#1e2d3d] p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight text-[#f0f4f8]">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-[#5a7080]">
          {pageState === 'ready'
            ? 'Choose a new password for your account.'
            : pageState === 'loading'
              ? 'Verifying your reset link…'
              : 'Unable to verify this reset link.'}
        </p>

        {pageState === 'loading' && (
          <p className="mt-8 text-sm text-[#5a7080]">Please wait…</p>
        )}

        {pageState === 'expired' && (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-red-400" role="alert">
              This reset link is invalid or has expired
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-[#00e676] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {pageState === 'ready' && (
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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

        {pageState !== 'expired' && (
          <p className="mt-6 text-center text-sm text-[#5a7080]">
            <Link
              href="/login"
              className="text-[#00e676] hover:underline font-medium"
            >
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
