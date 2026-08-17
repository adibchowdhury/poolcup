'use client'

import Link from 'next/link'
import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthFormDivider } from '@/components/auth/auth-form-divider'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { PasswordInput, authInputClassName } from '@/components/auth/password-input'
import {
  resendSignupVerificationEmail,
  signUpWithPassword,
} from '@/src/lib/auth'
import {
  AUTH_INVALID_EMAIL_MESSAGE,
  AUTH_FOCUS_VISIBLE_CLASS,
  AUTH_PRIMARY_SUBMIT_CLASS,
  isValidEmailFormat,
} from '@/src/lib/auth-form'
import { capturePostHog } from '@/src/lib/posthog-client'
import { getSafeNext } from '@/src/lib/safe-redirect'

const inputClassName = authInputClassName
const RESEND_COOLDOWN_SECONDS = 60

function afterSignupHref(next: string | null): string {
  if (!next) return '/onboarding'
  if (
    next === '/onboarding' ||
    next.startsWith('/onboarding?') ||
    next.startsWith('/onboarding/')
  ) {
    return next
  }
  return `/onboarding?next=${encodeURIComponent(next)}`
}

function CreateAccountPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = getSafeNext(searchParams)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const raw = searchParams.get('source')
    const source =
      raw === 'referral' ||
      raw === 'organic' ||
      raw === 'invite' ||
      raw === 'landing' ||
      raw === 'ads'
        ? raw
        : undefined
    capturePostHog(
      'signup_started',
      source ? { source } : undefined,
    )
  }, [searchParams])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  async function handleSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setResendMessage(null)

    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required')
      return
    }

    if (!isValidEmailFormat(email)) {
      setError(AUTH_INVALID_EMAIL_MESSAGE)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error: authError, needsEmailConfirmation, alreadyRegistered } =
      await signUpWithPassword(email, password, { firstName, lastName })

    setLoading(false)

    const rawSource = searchParams.get('source')
    const source =
      rawSource === 'referral' ||
      rawSource === 'organic' ||
      rawSource === 'invite' ||
      rawSource === 'landing' ||
      rawSource === 'ads'
        ? rawSource
        : undefined

    if (authError) {
      capturePostHog('signup_failed', {
        reason: alreadyRegistered ?? 'error',
      })
      if (alreadyRegistered === 'ambiguous') {
        setError(null)
        setInfo(authError.message)
        setPendingConfirmation(true)
        return
      }
      setError(authError.message)
      return
    }

    if (needsEmailConfirmation) {
      capturePostHog(
        'signup_completed',
        source ? { source } : undefined,
      )
      setPendingConfirmation(true)
      setInfo('Account created. Check your email to confirm, then sign in.')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      return
    }

    capturePostHog(
      'signup_completed',
      source ? { source } : undefined,
    )
    router.push(afterSignupHref(next))
  }

  async function handleResendVerification() {
    setResendMessage(null)
    setError(null)

    if (!isValidEmailFormat(email)) {
      setError(AUTH_INVALID_EMAIL_MESSAGE)
      return
    }

    if (resendCooldown > 0 || resendLoading) return

    setResendLoading(true)
    const { error: resendError } = await resendSignupVerificationEmail(email)
    setResendLoading(false)

    if (resendError) {
      setError(resendError.message)
      return
    }

    setResendMessage('Verification email sent. Check your inbox.')
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const loginHref = next
    ? `/login?next=${encodeURIComponent(next)}`
    : '/login'

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-8 shadow-xl">
        <div className="flex justify-center">
          <PoolCupLogo />
        </div>
        <p className="mt-2 text-sm text-[#5a7080]">
          {mounted && next
            ? 'Create your free account to start your pool.'
            : 'Create your account'}
        </p>

        <div className="mt-8">
          <GoogleSignInButton next={afterSignupHref(next)} />
        </div>
        <AuthFormDivider />

        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="first-name"
                className="mb-2 block text-sm font-medium text-[#5a7080]"
              >
                First name
              </label>
              <input
                id="first-name"
                type="text"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alex"
                className={inputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="last-name"
                className="mb-2 block text-sm font-medium text-[#5a7080]"
              >
                Last name
              </label>
              <input
                id="last-name"
                type="text"
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Jordan"
                className={inputClassName}
              />
            </div>
          </div>

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
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-[#5a7080]"
            >
              Password
            </label>
            <PasswordInput
              id="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-2 block text-sm font-medium text-[#5a7080]"
            >
              Confirm password
            </label>
            <PasswordInput
              id="confirm-password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          {info && (
            <p className="text-sm text-[#00e676]" role="status">
              {info}{' '}
              <Link href={loginHref} className="font-medium underline">
                Sign in
              </Link>
            </p>
          )}

          {pendingConfirmation && (
            <div className="space-y-2 rounded-lg border border-[#1e2d3d] bg-[#080b0f]/60 p-3">
              {resendMessage && (
                <p className="text-sm text-[#00e676]" role="status">
                  {resendMessage}
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={resendLoading || resendCooldown > 0}
                className={`w-full rounded-lg border border-[#00e676]/40 px-4 py-2.5 text-sm font-medium text-[#00e676] transition-colors hover:bg-[#00e676]/10 disabled:cursor-not-allowed disabled:opacity-50 ${AUTH_FOCUS_VISIBLE_CLASS}`}
              >
                {resendLoading
                  ? 'Sending…'
                  : resendCooldown > 0
                    ? `Resend verification email (${resendCooldown}s)`
                    : 'Resend verification email'}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={AUTH_PRIMARY_SUBMIT_CLASS}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-[#5a7080]">
            Already have an account?{' '}
            <Link
              href={loginHref}
              className="font-medium text-[#00e676] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}

export default function CreateAccountPage() {
  return (
    <Suspense fallback={null}>
      <CreateAccountPageContent />
    </Suspense>
  )
}
