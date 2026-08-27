'use client'

import Link from 'next/link'
import { FormEvent, Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthFormDivider } from '@/components/auth/auth-form-divider'
import { PuckyLoginEyes } from '@/components/auth/pucky-login-eyes'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { PasswordInput, authInputClassName } from '@/components/auth/password-input'
import { sendPasswordResetEmail, signInWithPassword } from '@/src/lib/auth'
import {
  AUTH_INVALID_EMAIL_MESSAGE,
  AUTH_PRIMARY_SUBMIT_CLASS,
  isValidEmailFormat,
} from '@/src/lib/auth-form'
import { capturePostHog } from '@/src/lib/posthog-client'
import { PUCKY_EYE_ASSET } from '@/src/lib/pucky-eye-calibration'
import { getSafeNext } from '@/src/lib/safe-redirect'

const inputClassName = authInputClassName

type AuthMode = 'signin' | 'forgot'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = getSafeNext(searchParams)
  const puckyFrameRef = useRef<HTMLImageElement>(null)
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (searchParams.get('error') === 'auth_callback') {
      setError('Sign-in could not be completed. Please try again.')
      setMode('signin')
    }
  }, [searchParams])

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError(null)
    setInfo(null)
    setForgotSent(false)
    setPassword('')
  }

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!isValidEmailFormat(email)) {
      setError(AUTH_INVALID_EMAIL_MESSAGE)
      return
    }

    capturePostHog('login_submitted')
    setLoading(true)

    const { error: authError } = await signInWithPassword(email, password)

    setLoading(false)

    if (authError) {
      capturePostHog('login_failed')
      setError(authError.message)
      return
    }

    capturePostHog('login_succeeded')
    router.push(next ?? '/dashboard')
  }

  async function handleForgotPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setForgotSent(false)

    if (!isValidEmailFormat(email)) {
      setError(AUTH_INVALID_EMAIL_MESSAGE)
      return
    }

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
    <main className="login-page-shell relative flex min-h-dvh items-center justify-center px-4">
      <div className="login-pucky-stage relative w-full max-w-[400px]">
        {/* Desktop: Pucky overlays the card top (hands on edge, in front). */}
        <img
          ref={puckyFrameRef}
          className="login-pucky-frame"
          src={PUCKY_EYE_ASSET.eyelessSrc}
          alt=""
          width={PUCKY_EYE_ASSET.width}
          height={PUCKY_EYE_ASSET.height}
          decoding="async"
          aria-hidden="true"
        />
        <PuckyLoginEyes frameRef={puckyFrameRef} />
        <div className="login-pucky-card relative z-10 w-full overflow-hidden rounded-2xl border border-[#1e2d3d] bg-[#111a27] px-8 py-5 shadow-xl">
          <div className="flex justify-center">
            <PoolCupLogo />
          </div>
          <p className="mt-2 text-sm text-[#5a7080]">
            {mode === 'signin'
              ? mounted && next
                ? 'Sign in to create your pool, or create a free account below.'
                : 'Sign in to your account'
              : 'Reset your password'}
          </p>

          {mode === 'signin' && (
            <>
              <div className="mt-3">
                <GoogleSignInButton next={next ?? undefined} />
              </div>
              <AuthFormDivider className="my-3" />
              <form onSubmit={handleSignIn} className="space-y-2.5">
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
                  className={AUTH_PRIMARY_SUBMIT_CLASS}
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
                    className={AUTH_PRIMARY_SUBMIT_CLASS}
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
