'use client'

import Link from 'next/link'
import { FormEvent, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Mail } from 'lucide-react'
import { AuthFormDivider } from '@/components/auth/auth-form-divider'
import { LoginPanelConfetti, LOGIN_CONFETTI_BLEED_LEFT_PX } from '@/components/auth/login-panel-confetti'
import { LoginPanelLeaderboard } from '@/components/auth/login-panel-leaderboard'
import { LoginPanelTestimonial } from '@/components/auth/login-panel-testimonial'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { PasswordInput, authInputClassName } from '@/components/auth/password-input'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { sendPasswordResetEmail, signInWithPassword } from '@/src/lib/auth'
import {
  AUTH_FOCUS_VISIBLE_CLASS,
  AUTH_INVALID_EMAIL_MESSAGE,
  AUTH_PRIMARY_SUBMIT_CLASS,
  isValidEmailFormat,
} from '@/src/lib/auth-form'
import { capturePostHog } from '@/src/lib/posthog-client'
import { getSafeNext } from '@/src/lib/safe-redirect'
import { bindTactilePress } from '@/src/lib/tactile-press'
import { cn } from '@/lib/utils'

/** Full baked Pucky (eyes in art) — same seat for mobile + desktop. */
const PUCKY_LOGIN_FRAME = {
  src: '/login_assets/pucky-login-frame.png',
  width: 1536,
  height: 1024,
} as const

/**
 * Login page background experiment switch.
 * - 'gradient' → CSS forest gradient + footprint wallpaper (default / revert)
 * - 'image'    → public/background_01.png cover field
 * Flip this one constant to revert — gradient CSS is never deleted.
 */
const LOGIN_BACKGROUND: 'image' | 'gradient' = 'image'

/**
 * Login fields: #20221F fill (echoes right panel), borderless at rest.
 * Focus keeps the app green ring (borderless-safe). Placeholder matches label #91A39D.
 */
const loginFieldSurfaceClassName =
  'bg-[#20221F] border-0 border-transparent placeholder:text-[#91A39D] focus:border-transparent'

const loginInputClassName = cn(
  authInputClassName,
  loginFieldSurfaceClassName,
  'pl-11',
)

const loginLabelClassName = 'mb-2 block text-sm font-medium text-[#91A39D]'
const loginFieldIconClassName =
  'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#91A39D]'

/** Layered lift — dark depth + barely-there emerald ambient + faint top-edge thickness. */
const loginCardElevationClassName =
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_16px_rgba(0,0,0,0.35),0_24px_60px_rgba(0,0,0,0.40),0_0_40px_rgba(0,230,118,0.015)]'

/**
 * Pill Sign in — white on #00A85D + shared straight-down tactile (`.ui-tactile-btn`).
 * Surface token drives edge via color-mix(surface 70%, black) — no local edge hand-pick.
 * Contrast ≈3.11:1 vs white — best in the requested #00B368–#00A85D band;
 * still short of WCAG AA 4.5:1 (would need ~#008F4C / darker).
 */
const loginSignInClassName = cn(
  'ui-tactile-btn w-full rounded-full border-none bg-[#00A85D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#00A85D]/90 disabled:cursor-not-allowed disabled:opacity-50',
  AUTH_FOCUS_VISIBLE_CLASS,
)

/** Login Sign in fill — edge derives from --tactile-btn-surface at the shared layer. */
const LOGIN_SIGN_IN_SURFACE = '#00A85D'

type AuthMode = 'signin' | 'forgot'

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
    <main
      className={cn(
        /* Flex column: 2:3 free-space spacers optically lift the combined unit
           (40% above / 60% below). Spacers shrink on short viewports → scroll, no clip. */
        'login-page-shell relative flex min-h-dvh flex-col items-center overflow-y-auto px-5 lg:px-4',
        LOGIN_BACKGROUND === 'image' && 'login-page-shell--image',
      )}
    >
      <div className="login-vcenter-before" aria-hidden="true" />
      {/*
        Mobile: ~90% width form-only card. Desktop: 800px 50/50 stage.
        Pucky anchors to .login-pucky-panel-form (full width mobile / left half desktop).
        Stage box includes Pucky overhang spacer → true combined unit for v-centering.
      */}
      <div className="login-pucky-stage relative mx-auto w-full max-w-[24rem] lg:max-w-[800px]">
        {/*
          Flow spacer = Pucky overhang (handY × frameH − overlap), derived from
          stage width + scale vars — so the stage box is the true composition
          (head→card bottom) for the 40/60 optical lift.
        */}
        <div className="login-pucky-overhang" aria-hidden="true" />
        <div className="login-pucky-body relative">
        {/* Mobile + desktop: full baked Pucky in the existing seat (scale/position via CSS vars). */}
        <img
          className="login-pucky-frame login-pucky-frame--mobile"
          src={PUCKY_LOGIN_FRAME.src}
          alt=""
          width={PUCKY_LOGIN_FRAME.width}
          height={PUCKY_LOGIN_FRAME.height}
          decoding="async"
          aria-hidden="true"
        />
        <img
          className="login-pucky-frame login-pucky-frame--desktop"
          src={PUCKY_LOGIN_FRAME.src}
          alt=""
          width={PUCKY_LOGIN_FRAME.width}
          height={PUCKY_LOGIN_FRAME.height}
          decoding="async"
          aria-hidden="true"
        />
        <div
          className={cn(
            'login-pucky-card relative z-10 grid w-full grid-cols-1 overflow-hidden rounded-2xl border border-[#1e2d3d] bg-[#171717] lg:grid-cols-2',
            loginCardElevationClassName,
          )}
        >
          {/* Left = form column centered; z-20 keeps fields above seam bleed.
              Mobile: slightly tighter vertical rhythm (~5–10% shorter card). */}
          <div className="login-pucky-panel-form relative z-20 flex flex-col items-center px-5 pb-3 pt-7 lg:px-8 lg:pb-5 lg:pt-10">
            <div className="w-full max-w-[17rem]">
            {/* Mobile-only brand mark → homepage; desktop card stays logo-less. */}
            <div className="login-mobile-logo mb-3.5 lg:hidden">
              <PoolCupLogo
                href="/"
                className="!h-9 !w-[105px] sm:!h-9 sm:!w-[105px]"
              />
            </div>
            {mode === 'signin' ? (
              <>
                {/* Teko display — slightly smaller on mobile; text-4xl desktop. */}
                <h1 className="font-display text-center text-3xl tracking-wide text-[#e8f0ec] lg:text-4xl">
                  Welcome back
                </h1>
                <p className="mt-1 text-center text-sm text-[#96A29D]">
                  {mounted && next
                    ? 'Sign in to create your pool, or create a free account below.'
                    : 'Your picks are waiting'}
                </p>
              </>
            ) : (
              <h1 className="font-display text-center text-3xl tracking-wide text-[#e8f0ec] lg:text-4xl">
                Reset your password
              </h1>
            )}

            {mode === 'signin' && (
              <>
                {/* Mobile: mt-6 (sub→fields); desktop keeps mt-8. */}
                <form
                  onSubmit={handleSignIn}
                  className="login-signin-form mt-6 space-y-2.5 lg:mt-8"
                >
                  <div>
                    <div className="relative">
                      <Mail className={loginFieldIconClassName} aria-hidden />
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        aria-label="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className={loginInputClassName}
                      />
                    </div>
                  </div>

                  <div>
                    <PasswordInput
                      id="password"
                      required
                      autoComplete="current-password"
                      aria-label="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className={loginFieldSurfaceClassName}
                      leadingIcon={<Lock className="h-4 w-4" aria-hidden />}
                      leadingIconClassName="text-[#91A39D]"
                    />
                    {/* Attached to password (mt-1.5); Sign in mt below closes the orphan gap. */}
                    <div className="mt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-xs text-[#00e676] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
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

                  {/* Mobile: mt-2.5 under forgot (was mt-5 orphan); desktop mt-5. */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      loginSignInClassName,
                      'login-signin-submit mt-2.5 mb-3 lg:mt-5 lg:mb-4',
                    )}
                    style={
                      {
                        '--tactile-btn-surface': LOGIN_SIGN_IN_SURFACE,
                      } as CSSProperties
                    }
                    onPointerDown={(event) => bindTactilePress(event.currentTarget)}
                  >
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>

                <AuthFormDivider className="my-0" surfaceClassName="bg-[#171717]" />

                <div className="mt-2.5 lg:mt-3">
                  <GoogleSignInButton
                    next={next ?? undefined}
                    variant="branded"
                    label="Sign in with Google"
                  />
                </div>

                <p className="mt-2.5 text-center text-xs text-[#5a7080] lg:mt-3">
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
                      <label htmlFor="forgot-email" className={loginLabelClassName}>
                        Email
                      </label>
                      <div className="relative">
                        <Mail className={loginFieldIconClassName} aria-hidden />
                        <input
                          id="forgot-email"
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className={loginInputClassName}
                        />
                      </div>
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

          {/*
            Right panel — overflow visible so back confetti can bleed ~56px past
            the seam; card overflow clips. Form z-20 sits above the bleed.
          */}
          <div className="login-pucky-panel-aside relative z-10 hidden min-h-0 overflow-visible bg-[#20221F] lg:block">
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-0"
              style={{ left: `-${LOGIN_CONFETTI_BLEED_LEFT_PX}px` }}
              aria-hidden
            >
              <LoginPanelConfetti
                density="normal"
                bleedLeftPx={LOGIN_CONFETTI_BLEED_LEFT_PX}
                className="z-0"
              />
            </div>
            <div className="pointer-events-none relative z-10 flex h-full flex-col">
              {/* Equal flex-1: vertically center podium+quote as one composition. */}
              <div className="min-h-0 flex-1" aria-hidden />
              <div className="shrink-0">
                <LoginPanelLeaderboard />
                <LoginPanelTestimonial />
              </div>
              <div className="min-h-0 flex-1" aria-hidden />
            </div>
          </div>
        </div>
        </div>
      </div>
      <div className="login-vcenter-after" aria-hidden="true" />
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
