'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  sendPasswordResetEmail,
  signInWithPassword,
  signUpWithPassword,
} from '@/src/lib/auth'

const inputClassName =
  'w-full rounded-lg bg-[#080b0f] border border-[#1e2d3d] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:outline-none focus:ring-2 focus:ring-[#00e676]/50 focus:border-[#00e676]'

type AuthMode = 'signin' | 'signup' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setInfo(null)
    setForgotSent(false)
    setPassword('')
    setConfirmPassword('')
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

    router.push('/dashboard')
  }

  async function handleSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error: authError, needsEmailConfirmation } =
      await signUpWithPassword(email, password)

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (needsEmailConfirmation) {
      setInfo('Account created. Check your email to confirm, then sign in.')
      switchMode('signin')
      return
    }

    router.push('/dashboard')
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

  const subtitle =
    mode === 'signin'
      ? 'Sign in to your account'
      : mode === 'signup'
        ? 'Create your PoolCup account'
        : 'Reset your password'

  return (
    <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-[#111a27] border border-[#1e2d3d] p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight text-[#f0f4f8]">
          PoolCup
        </h1>
        <p className="mt-2 text-sm text-[#5a7080]">{subtitle}</p>

        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#5a7080] mb-2"
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
              <div className="flex items-center justify-between mb-2">
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
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClassName}
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
              className="w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="text-center text-sm text-[#5a7080]">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-[#00e676] hover:underline font-medium"
              >
                Create account
              </button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="signup-email"
                className="block text-sm font-medium text-[#5a7080] mb-2"
              >
                Email
              </label>
              <input
                id="signup-email"
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
              <label
                htmlFor="signup-password"
                className="block text-sm font-medium text-[#5a7080] mb-2"
              >
                Password
              </label>
              <input
                id="signup-password"
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
                htmlFor="confirm-password"
                className="block text-sm font-medium text-[#5a7080] mb-2"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <p className="text-center text-sm text-[#5a7080]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-[#00e676] hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          </form>
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
                    className="block text-sm font-medium text-[#5a7080] mb-2"
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
                  className="w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-[#5a7080]">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-[#00e676] hover:underline font-medium"
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
