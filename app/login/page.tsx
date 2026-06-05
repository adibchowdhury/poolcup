'use client'

import Link from 'next/link'
import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthFormDivider } from '@/components/auth/auth-form-divider'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { PasswordInput, authInputClassName } from '@/components/auth/password-input'
import { sendPasswordResetEmail, signInWithPassword } from '@/src/lib/auth'

const inputClassName = authInputClassName

type AuthMode = 'signin' | 'forgot'

function getSafeNext(searchParams: URLSearchParams): string | null {
  const next = searchParams.get('next')
  if (next?.startsWith('/') && !next.startsWith('//')) {
    return next
  }
  return null
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = getSafeNext(searchParams)
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)

  useEffect(() => {
    if (searchParams.get('error') === 'auth_callback') {
      setError('Sign-in could not be completed. Please try again.')
      setMode('signin')
    }
  }, [searchParams])

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setInfo(null)
    setForgotSent(false)
    setPassword('')
  }

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    const { error: authError } = await signInWithPassword(email, password)

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    router.push(next ?? '/dashboard')
  }

  async function handleForgotPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setForgotSent(false)
    setLoading(true)

    const { error: authError } = await sendPasswordResetEmail(email)

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    setForgotSent(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080b0f] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight text-[#f0f4f8]">
          PoolCup
        </h1>
        <p className="mt-2 text-sm text-[#5a7080]">
          {mode === 'signin' ? 'Sign in to your account' : 'Reset your password'}
        </p>

        {mode === 'signin' && (
          <>
            <div className="mt-8">
              <GoogleSignInButton next={next ?? undefined} />
            </div>
            <AuthFormDivider />
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-[#5a7080]"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClassName}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[#5a7080]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-sm text-[#00e676] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <PasswordInput
                  id="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}

              {info && (
                <p className="text-sm text-[#00e676]" role="status">
                  {info}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <p className="text-center text-sm text-[#5a7080]">
                Don&apos;t have an account?{' '}
                <Link
                  href={
                    next
                      ? `/create-account?next=${encodeURIComponent(next)}`
                      : '/create-account'
                  }
                  className="font-medium text-[#00e676] hover:underline"
                >
                  Create account
                </Link>
              </p>
            </form>
          </>
        )}

        {mode === 'forgot' && (
          <>
            {forgotSent ? (
              <div className="mt-8 rounded-lg border border-[#00e676]/30 bg-[#00e676]/10 p-4">
                <p className="text-sm text-[#00e676]">
                  Check your email for a password reset link
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="mt-8 space-y-4">
                <div>
                  <label
                    htmlFor="forgot-email"
                    className="mb-2 block text-sm font-medium text-[#5a7080]"
                  >
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
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
                  className="w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-[#5a7080]">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="font-medium text-[#00e676] hover:underline"
              >
                Back to sign in
              </button>
            </p>
          </>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
