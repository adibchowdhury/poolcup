'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react'
import { flushSync } from 'react-dom'
import { Check, ChevronLeft, Loader2, Plus } from 'lucide-react'
import { bindTactilePress } from '@/src/lib/tactile-press'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  CREATE_POOL_HREF,
  EXPLORE_HREF,
  JOIN_POOL_HREF,
  ONBOARDING_REFERRAL_OPTIONS,
  ONBOARDING_SPORT_OPTIONS,
  ONBOARDING_STEPS,
  nextStep,
  previousStep,
  resolveResumeStep,
  stepIndex,
  type OnboardingReferralId,
  type OnboardingSportId,
  type OnboardingState,
  type OnboardingStepId,
} from '@/src/lib/onboarding'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { uploadCurrentUserAvatar } from '@/src/lib/upload-user-avatar'
import {
  checkUsernameAvailable,
  ensureDefaultUsername,
  getUsernameFormatError,
  normalizeUsernameInput,
  usernameFormatErrorMessage,
  USERNAME_RULES_HINT,
} from '@/src/lib/username'

export type OnboardingBootstrap = {
  userId: string | null
  username: string | null
  displayName: string | null
  favoriteSports: string[]
  avatar: string | null
  customAvatarUrl: string | null
  referralSource: string | null
  onboardingState: OnboardingState
  nextPath: string
}

const USERNAME_DEBOUNCE_MS = 400
/** Full carousel slide+fade duration (ms). Single source for CSS and the JS timer. */
const SLIDE_MS = 750

function slideMotionStyle(
  property: 'transform' | 'opacity',
  enabled: boolean,
): CSSProperties {
  if (!enabled) return {}
  return {
    transitionProperty: property,
    transitionDuration: `${SLIDE_MS}ms`,
    transitionTimingFunction: 'ease-in-out',
  }
}

/**
 * Numbered Pucky poses (pucky_1…6). sports_identity keeps SportBallsOrbit
 * even though pucky_4.webp exists for that slot. Create profile and You're
 * Ready have no numbered file.
 */
const ONBOARDING_MASCOT_SRC: Partial<
  Record<OnboardingStepId, string>
> = {
  welcome: '/mascot/onboarding_mascot/pucky_1.webp',
  predict_compete: '/mascot/onboarding_mascot/pucky_2.webp',
  your_pool: '/mascot/onboarding_mascot/pucky_3.webp',
  // sports_identity: pucky_4.webp exists; keep orbit balls
  better_friends: '/mascot/onboarding_mascot/pucky_5.webp',
  referral_source: '/mascot/onboarding_mascot/pucky_6.webp',
}

const ONBOARDING_MASCOT_PRELOAD_SRCS = [
  '/mascot/onboarding_mascot/pucky_1.webp',
  '/mascot/onboarding_mascot/pucky_2.webp',
  '/mascot/onboarding_mascot/pucky_3.webp',
  '/mascot/onboarding_mascot/pucky_4.webp',
  '/mascot/onboarding_mascot/pucky_5.webp',
  '/mascot/onboarding_mascot/pucky_6.webp',
] as const

/** Orbit balls for the sports-identity step. Duration via CSS var. */
const SPORT_ORBIT_BALLS = [
  { src: '/sports/soccer.png' },
  { src: '/sports/basketball.png' },
  { src: '/sports/football.png' },
  { src: '/sports/hockey.png' },
  { src: '/sports/baseball.png' },
] as const

const POOLCUP_LOGO_SRC = '/poolcup-logo.png'

/** Intrinsic size for next/image + CLS reservation (matches display box). */
const MASCOT_INTRINSIC = 400
/** CSS display box: h-56 / sm:h-64 — reserved so slides don't jump. */
const MASCOT_FRAME_CLASS =
  'relative mx-auto flex h-56 w-56 shrink-0 items-end justify-center sm:h-64 sm:w-64 lg:h-[13rem] lg:w-[13rem] xl:h-[15rem] xl:w-[15rem]'
/** Selection slides: scaled down from hero just enough for wrapped pills at ~667px. */
const MASCOT_FRAME_COMPACT_CLASS =
  'relative mx-auto flex h-48 w-48 shrink-0 items-end justify-center sm:h-64 sm:w-64 lg:h-[13rem] lg:w-[13rem] xl:h-[15rem] xl:w-[15rem]'
/** Referral: extra-small mobile mascot so pills + nav stay on-screen. */
const MASCOT_FRAME_TIGHT_CLASS =
  'relative mx-auto flex h-36 w-36 shrink-0 items-end justify-center sm:h-64 sm:w-64 lg:h-[13rem] lg:w-[13rem] xl:h-[15rem] xl:w-[15rem]'
/** Welcome + value slides: shared hero frame. Desktop is half the previous lg size. */
const MASCOT_FRAME_HERO_CLASS =
  'relative mx-auto flex h-[16.5rem] w-[16.5rem] shrink-0 items-end justify-center sm:h-[19.5rem] sm:w-[19.5rem] lg:h-[13rem] lg:w-[13rem] xl:h-[15rem] xl:w-[15rem]'
const MASCOT_IMAGE_CLASS =
  'h-full w-full object-contain object-bottom'
const ONBOARDING_TITLE_CLASS =
  'text-center font-display text-3xl leading-tight tracking-wide text-foreground sm:text-5xl lg:text-left'
const PANEL_SHELL_CLASS =
  'flex min-h-0 w-full flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-1 lg:gap-x-12 xl:gap-x-16'
/** image→dots: 5rem (80px) */
const MOBILE_IMAGE_TO_DOTS_GAP_CLASS = 'h-20 shrink-0 lg:hidden'
/** title→copy / copy→pills: 32px */
const MOBILE_GROUP_GAP_CLASS = 'h-8 shrink-0 lg:hidden'
/** dots→title: 48px */
const MOBILE_DOTS_TO_TITLE_GAP_CLASS = 'h-12 shrink-0 lg:hidden'

/**
 * 3D motion durations — applied as CSS vars on the shell; motion lives in
 * `.ui-tactile-btn` in globals.css (plain CSS, not Tailwind variants).
 * Onboarding sets `--onboarding-btn-*-ms`; unified tactile reads them as fallbacks.
 */
const ONBOARDING_BTN_HOVER_IN_MS = 290
const ONBOARDING_BTN_HOVER_OUT_MS = 270
const ONBOARDING_BTN_PRESS_MS = 150

const ONBOARDING_BTN_MOTION_VARS = {
  '--onboarding-btn-hover-in-ms': `${ONBOARDING_BTN_HOVER_IN_MS}ms`,
  '--onboarding-btn-hover-out-ms': `${ONBOARDING_BTN_HOVER_OUT_MS}ms`,
  '--onboarding-btn-press-ms': `${ONBOARDING_BTN_PRESS_MS}ms`,
} as CSSProperties

const ONBOARDING_BTN_3D_PRIMARY = cn(
  'ui-tactile-btn ui-tactile-btn--primary',
  'font-semibold text-primary-foreground',
  '[-webkit-tap-highlight-color:transparent] touch-manipulation select-none',
  'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_68%,white),var(--primary))]',
  'hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_68%,white),var(--primary))]',
  'active:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_68%,white),var(--primary))]',
  'disabled:pointer-events-none disabled:opacity-100',
)

const ONBOARDING_BTN_3D_BACK = cn(
  'ui-tactile-btn',
  'text-foreground',
  '[-webkit-tap-highlight-color:transparent] touch-manipulation select-none',
  'bg-[linear-gradient(180deg,#243044,#111a27)]',
  'hover:bg-[linear-gradient(180deg,#243044,#111a27)]',
  'active:bg-[linear-gradient(180deg,#243044,#111a27)]',
  'disabled:pointer-events-none disabled:opacity-100',
)

const ONBOARDING_PRELOAD_SRCS = [
  ...ONBOARDING_MASCOT_PRELOAD_SRCS,
  POOLCUP_LOGO_SRC,
  ...SPORT_ORBIT_BALLS.map((ball) => ball.src),
] as const

function OnboardingMascot({
  src,
  priority = false,
  compact = false,
  hero = false,
  tight = false,
}: {
  src: string
  priority?: boolean
  compact?: boolean
  hero?: boolean
  tight?: boolean
}) {
  const frameClass = hero
    ? MASCOT_FRAME_HERO_CLASS
    : tight
      ? MASCOT_FRAME_TIGHT_CLASS
      : compact
        ? MASCOT_FRAME_COMPACT_CLASS
        : MASCOT_FRAME_CLASS

  return (
    <div className={frameClass}>
      <Image
        src={src}
        alt=""
        width={MASCOT_INTRINSIC}
        height={MASCOT_INTRINSIC}
        unoptimized
        decoding="sync"
        sizes={
          hero
            ? '(min-width: 1280px) 240px, (min-width: 1024px) 208px, (min-width: 640px) 312px, 264px'
            : tight
              ? '(min-width: 1024px) 208px, (min-width: 640px) 256px, 144px'
              : compact
                ? '(min-width: 1024px) 208px, (min-width: 640px) 256px, 192px'
                : '(min-width: 1024px) 208px, (min-width: 640px) 256px, 224px'
        }
        priority={priority}
        className={MASCOT_IMAGE_CLASS}
      />
    </div>
  )
}

/**
 * Sport balls evenly spaced on a circle (used on sports_identity).
 * CSS `transform: rotate` on the ring (GPU-friendly); nested counter-rotate
 * keeps icons upright. Duration: `--onboarding-sport-orbit-duration` in CSS.
 */
function SportBallsOrbit({ priority = false }: { priority?: boolean }) {
  const count = SPORT_ORBIT_BALLS.length

  return (
    <div
      className={cn(
        MASCOT_FRAME_COMPACT_CLASS,
        'overflow-hidden',
        '[--onboarding-sport-orbit-radius:-4.75rem]',
        'sm:[--onboarding-sport-orbit-radius:-6.5rem]',
        'lg:[--onboarding-sport-orbit-radius:-5.5rem]',
        'xl:[--onboarding-sport-orbit-radius:-6.5rem]',
      )}
      aria-hidden
    >
      <div className="animate-onboarding-sport-orbit absolute inset-0">
        {SPORT_ORBIT_BALLS.map((ball, index) => {
          const angle = (360 / count) * index
          return (
            <div
              key={ball.src}
              className="absolute left-1/2 top-1/2 h-11 w-11 sm:h-12 sm:w-12 lg:h-8 lg:w-8"
              style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(var(--onboarding-sport-orbit-radius))`,
              }}
            >
              {/* Static cancel of placement angle + animated cancel of orbit spin */}
              <div
                className="h-full w-full"
                style={{ transform: `rotate(${-angle}deg)` }}
              >
                <div className="animate-onboarding-sport-orbit-counter h-full w-full">
                  <Image
                    src={ball.src}
                    alt=""
                    width={96}
                    height={96}
                    sizes="48px"
                    unoptimized
                    priority={priority}
                    className="h-full w-full object-contain drop-shadow-sm"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PILL_BASE_CLASS = cn(
  'rounded-full border px-2.5 py-1.5 text-center text-sm font-medium leading-snug transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
)

function pillClass(selected: boolean) {
  return cn(
    PILL_BASE_CLASS,
    selected
      ? 'border-primary bg-primary/15 text-primary'
      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
  )
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return reduced
}

/** Desktop-only step dots: current step is an elongated pill. */
function OnboardingDotStepper({
  currentIndex,
  total,
  animate,
  className,
}: {
  currentIndex: number
  total: number
  animate: boolean
  className?: string
}) {
  return (
    <div
      className={cn('flex items-center justify-start gap-1.5', className)}
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${currentIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, index) => {
        const isCurrent = index === currentIndex
        const isCompleted = index < currentIndex
        return (
          <span
            key={ONBOARDING_STEPS[index]}
            className={cn(
              'h-2 shrink-0 rounded-full',
              isCurrent ? 'w-8' : 'w-2',
              isCurrent || isCompleted
                ? 'bg-[#00e676]'
                : 'bg-muted-foreground/35',
              animate && 'transition-[width] duration-200 ease-in-out',
            )}
            aria-hidden
          />
        )
      })}
    </div>
  )
}

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

type InfoSlide = {
  id: OnboardingStepId
  title: string
  body: string
}

const INFO_SLIDES: InfoSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to',
    body: 'Predict with friends, climb the standings, and claim the bragging rights.',
  },
  {
    id: 'predict_compete',
    title: 'Predict. Compete. Climb.',
    body: 'Create or join a pool, lock in your picks before kickoff, and watch the live leaderboard move with every result. Exact-score or winner-only styles — standings update as matches finish.',
  },
  {
    id: 'your_pool',
    title: 'Your Pool. Your Rules.',
    body: 'Run the pool your way. Basic pools are free; Custom Pool ($9.99 one-time) unlocks logo & colors, custom scoring, announcements, polls, and commissioner tools — members always play free.',
  },
  {
    id: 'sports_identity',
    title: 'Build Your Sports Identity.',
    body: 'Your profile is your résumé — earn XP, unlock badges, and customize your look and favorites.',
  },
  {
    id: 'better_friends',
    title: 'Better With Friends.',
    body: 'Add friends, chat about the slate, and turn every matchweek into a social competition beyond a single pool.',
  },
]

function initialUsername(bootstrap: OnboardingBootstrap): string {
  const draft = bootstrap.onboardingState.username_draft?.trim()
  const assigned = bootstrap.username?.trim()
  return draft || assigned || ''
}

export function OnboardingFlow({
  bootstrap,
  preview = false,
  previewStep,
}: {
  bootstrap: OnboardingBootstrap
  /** Design preview: no DB writes, no XP, no completion flag changes. */
  preview?: boolean
  /** Jump to this step when `preview` is true. */
  previewStep?: OnboardingStepId
}) {
  const router = useRouter()
  const prefersReducedMotion = usePrefersReducedMotion()
  const userId = bootstrap.userId
  const initialStep: OnboardingStepId =
    preview && previewStep
      ? previewStep
      : resolveResumeStep(bootstrap.onboardingState)
  const [step, setStep] = useState<OnboardingStepId>(initialStep)
  /** Dual-panel carousel: track is 200% wide; translateX 0 or -50%. */
  const [isSliding, setIsSliding] = useState(false)
  const [trackX, setTrackX] = useState(0)
  const [trackTransition, setTrackTransition] = useState(false)
  const [leftPanelStep, setLeftPanelStep] =
    useState<OnboardingStepId>(initialStep)
  const [rightPanelStep, setRightPanelStep] = useState<OnboardingStepId | null>(
    () => nextStep(initialStep),
  )
  /** Opacity is independent of trackX so it can interpolate while panels are on-screen. */
  const [leftOpacity, setLeftOpacity] = useState(1)
  const [rightOpacity, setRightOpacity] = useState(0)
  const [slideTarget, setSlideTarget] = useState<OnboardingStepId | null>(null)
  const slideTimersRef = useRef<number[]>([])
  const [favoriteSports, setFavoriteSports] = useState<string[]>(
    () =>
      bootstrap.onboardingState.favorite_sports?.length
        ? bootstrap.onboardingState.favorite_sports
        : bootstrap.favoriteSports,
  )
  const [username, setUsername] = useState(() => initialUsername(bootstrap))
  const [referralSource, setReferralSource] = useState<OnboardingReferralId | null>(
    () => {
      const fromState = bootstrap.onboardingState.referral_source
      if (
        fromState &&
        ONBOARDING_REFERRAL_OPTIONS.some((opt) => opt.id === fromState)
      ) {
        return fromState as OnboardingReferralId
      }
      if (
        bootstrap.referralSource &&
        ONBOARDING_REFERRAL_OPTIONS.some(
          (opt) => opt.id === bootstrap.referralSource,
        )
      ) {
        return bootstrap.referralSource as OnboardingReferralId
      }
      return null
    },
  )
  const [availability, setAvailability] = useState<Availability>('idle')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState(
    bootstrap.avatar ?? 'white_skin_avatar.png',
  )
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(
    bootstrap.customAvatarUrl,
  )
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canRetry, setCanRetry] = useState(false)
  const retryFnRef = useRef<(() => Promise<void>) | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const startedRef = useRef(false)
  const usernameCheckGen = useRef(0)

  function clearErrorBanner() {
    setError(null)
    setCanRetry(false)
    retryFnRef.current = null
  }

  function reportError(message: string, retry?: () => Promise<void>) {
    setError(message)
    retryFnRef.current = retry ?? null
    setCanRetry(Boolean(retry))
  }

  async function handleRetry() {
    const fn = retryFnRef.current
    if (!fn) {
      clearErrorBanner()
      return
    }
    clearErrorBanner()
    await fn()
  }

  const onStarted = useEffectEvent(() => {
    if (preview) return
    if (startedRef.current) return
    startedRef.current = true
    capturePostHog('onboarding_started')
  })

  useEffect(() => {
    onStarted()
  }, [])

  /** Decode Pucky, logo, and sport-balls once so slide remounts don't pop in. */
  useEffect(() => {
    const links: HTMLLinkElement[] = []
    for (const src of ONBOARDING_PRELOAD_SRCS) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = src
      document.head.appendChild(link)
      links.push(link)

      const img = new window.Image()
      img.src = src
      void img.decode?.().catch(() => {})
    }

    return () => {
      for (const link of links) link.remove()
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const id of slideTimersRef.current) window.clearTimeout(id)
      slideTimersRef.current = []
    }
  }, [])

  const syncPreviewUrl = useCallback(
    (next: OnboardingStepId) => {
      if (!preview) return
      const params = new URLSearchParams({ preview: '1', step: next })
      router.replace(`/onboarding?${params.toString()}`, { scroll: false })
    },
    [preview, router],
  )

  const goToStep = useCallback(
    (next: OnboardingStepId, dir: 1 | -1) => {
      if (next === step || isSliding) return

      if (prefersReducedMotion) {
        setStep(next)
        setLeftPanelStep(next)
        setRightPanelStep(nextStep(next))
        setTrackX(0)
        setLeftOpacity(1)
        setRightOpacity(0)
        setTrackTransition(false)
        syncPreviewUrl(next)
        return
      }

      const startX = dir === 1 ? 0 : -50
      const endX = dir === 1 ? -50 : 0
      const startLeft = dir === 1 ? 1 : 0
      const startRight = dir === 1 ? 0 : 1
      const endLeft = dir === 1 ? 0 : 1
      const endRight = dir === 1 ? 1 : 0

      // Commit START pose with transitions off, then attach transitions on a
      // later frame, THEN set the end pose. If transition + end opacity land
      // in the same render, opacity jumps and the fade is invisible.
      flushSync(() => {
        if (dir === 1) {
          setLeftPanelStep(step)
          setRightPanelStep(next)
        } else {
          setLeftPanelStep(next)
          setRightPanelStep(step)
        }
        setTrackX(startX)
        setLeftOpacity(startLeft)
        setRightOpacity(startRight)
        setTrackTransition(false)
        setSlideTarget(next)
        setIsSliding(true)
      })

      let rafEnd = 0
      const rafEnable = requestAnimationFrame(() => {
        setTrackTransition(true)
        rafEnd = requestAnimationFrame(() => {
          setTrackX(endX)
          setLeftOpacity(endLeft)
          setRightOpacity(endRight)
        })
      })

      const doneTimer = window.setTimeout(() => {
        setTrackTransition(false)
        setStep(next)
        setLeftPanelStep(next)
        setRightPanelStep(nextStep(next))
        setTrackX(0)
        setLeftOpacity(1)
        setRightOpacity(0)
        syncPreviewUrl(next)
        setIsSliding(false)
        setSlideTarget(null)
        cancelAnimationFrame(rafEnable)
        cancelAnimationFrame(rafEnd)
      }, SLIDE_MS)
      slideTimersRef.current.push(doneTimer)
    },
    [isSliding, prefersReducedMotion, step, syncPreviewUrl],
  )

  useEffect(() => {
    let cancelled = false

    async function ensureUsernameWithRetry() {
      const assigned = bootstrap.username?.trim()
      if (assigned) {
        setUsername((prev) => prev.trim() || assigned)
        return
      }
      if (!userId) return
      const { username: generated, error: genError } = await ensureDefaultUsername(
        supabase,
        userId,
      )
      if (cancelled) return
      if (generated) {
        setUsername((prev) => prev.trim() || generated)
        return
      }
      if (genError) {
        reportError(genError, ensureUsernameWithRetry)
      }
    }

    void ensureUsernameWithRetry()
    return () => {
      cancelled = true
    }
  }, [bootstrap.username, userId])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/avatars')
      .then((res) => res.json())
      .then((files: unknown) => {
        if (cancelled || !Array.isArray(files)) return
        setAvailableAvatars(
          files.filter((f): f is string => typeof f === 'string'),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const buildDraftState = useCallback(
    (partial: OnboardingState = {}): OnboardingState => {
      const { display_name_draft: _ignored, ...existing } =
        bootstrap.onboardingState
      return {
        ...existing,
        step,
        favorite_sports: favoriteSports,
        username_draft: username || undefined,
        referral_source: referralSource ?? undefined,
        ...partial,
      }
    },
    [
      bootstrap.onboardingState,
      favoriteSports,
      referralSource,
      step,
      username,
    ],
  )

  const persistState = useCallback(
    async (partial: OnboardingState = {}) => {
      const nextState = buildDraftState(partial)
      if (preview || !userId) return nextState
      const { error: updateError } = await supabase
        .from('users')
        .update({ onboarding_state: nextState })
        .eq('id', userId)
      if (updateError) throw new Error(updateError.message)
      return nextState
    },
    [buildDraftState, preview, userId],
  )

  const completeOnboarding = useCallback(
    async (
      mode: 'completed' | 'skipped',
      redirectTo?: string,
    ): Promise<boolean> => {
      if (preview) {
        router.replace(redirectTo ?? bootstrap.nextPath)
        return true
      }

      if (!userId) {
        reportError('Sign in to finish onboarding.')
        return false
      }

      setSaving(true)
      clearErrorBanner()

      const normalizedUsername = normalizeUsernameInput(username)
      const profilePatch: Record<string, unknown> = {
        onboarding_completed: true,
        onboarding_state: {
          step: 'done',
          favorite_sports: favoriteSports,
          username_draft: normalizedUsername || undefined,
          referral_source: referralSource ?? undefined,
        },
        favorite_sports: favoriteSports,
      }
      if (normalizedUsername) profilePatch.username = normalizedUsername
      if (referralSource) profilePatch.referral_source = referralSource
      if (selectedAvatar) profilePatch.avatar = selectedAvatar
      if (customAvatarUrl !== undefined) {
        profilePatch.custom_avatar_url = customAvatarUrl
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(profilePatch)
        .eq('id', userId)

      setSaving(false)
      if (updateError) {
        reportError(updateError.message, () =>
          completeOnboarding(mode, redirectTo).then(() => undefined),
        )
        return false
      }

      capturePostHog(
        mode === 'skipped' ? 'onboarding_skipped' : 'onboarding_completed',
        {
          ...(referralSource ? { referral_source: referralSource } : {}),
        },
      )
      const { awardClientXp } = await import('@/src/lib/xp-client')
      await awardClientXp({ sourceType: 'onboarding_complete' })
      router.replace(redirectTo ?? bootstrap.nextPath)
      return true
    },
    [
      bootstrap.nextPath,
      customAvatarUrl,
      favoriteSports,
      preview,
      referralSource,
      router,
      selectedAvatar,
      userId,
      username,
    ],
  )

  async function advanceFrom(from: OnboardingStepId) {
    setSaving(true)
    clearErrorBanner()
    try {
      const following = nextStep(from)
      if (preview) {
        if (!following) {
          router.replace(bootstrap.nextPath)
          return
        }
        capturePostHog('onboarding_step_completed', { step: from })
        goToStep(following, 1)
        return
      }
      await persistState({ step: following ?? from })
      capturePostHog('onboarding_step_completed', {
        step: from,
        ...(from === 'referral_source' && referralSource
          ? { referral_source: referralSource }
          : {}),
      })
      if (!following) {
        await completeOnboarding('completed')
        return
      }
      goToStep(following, 1)
    } catch (err) {
      reportError(
        err instanceof Error ? err.message : 'Could not save progress',
        () => advanceFrom(from),
      )
    } finally {
      setSaving(false)
    }
  }

  function goPrevious() {
    const prior = previousStep(step)
    if (!prior || isSliding) return
    goToStep(prior, -1)
  }

  function toggleSport(id: OnboardingSportId) {
    setFavoriteSports((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  // Debounced username availability (profile step only)
  useEffect(() => {
    if (step !== 'create_profile' || !userId) return
    const normalized = normalizeUsernameInput(username)
    const formatError = getUsernameFormatError(normalized)
    if (formatError) {
      setAvailability('invalid')
      setUsernameError(usernameFormatErrorMessage(formatError))
      return
    }

    setAvailability('checking')
    setUsernameError(null)
    const gen = ++usernameCheckGen.current
    const timer = window.setTimeout(() => {
      void (async () => {
        const { available, error: availError } = await checkUsernameAvailable(
          supabase,
          normalized,
          userId,
        )
        if (usernameCheckGen.current !== gen) return
        if (availError) {
          setAvailability('idle')
          setUsernameError(availError)
          return
        }
        if (!available) {
          setAvailability('taken')
          setUsernameError('That username is taken. Try another.')
          return
        }
        setAvailability('available')
        setUsernameError(null)
      })()
    }, USERNAME_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [username, step, userId])

  async function saveProfileAndContinue() {
    const normalized = normalizeUsernameInput(username)
    const formatError = getUsernameFormatError(normalized)
    if (formatError) {
      setUsernameError(usernameFormatErrorMessage(formatError))
      setAvailability('invalid')
      return
    }

    if (
      availability === 'checking' ||
      availability === 'taken' ||
      availability === 'invalid'
    ) {
      return
    }

    if (preview) {
      setUsername(normalized)
      goToStep('youre_ready', 1)
      return
    }

    if (!userId) {
      reportError('Sign in to save your profile.')
      return
    }

    setSaving(true)
    clearErrorBanner()

    const { available, error: availError } = await checkUsernameAvailable(
      supabase,
      normalized,
      userId,
    )
    if (availError) {
      setSaving(false)
      reportError(availError, () => saveProfileAndContinue())
      return
    }
    if (!available) {
      setSaving(false)
      setAvailability('taken')
      setUsernameError('That username is taken. Try another.')
      return
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        username: normalized,
        favorite_sports: favoriteSports,
        avatar: selectedAvatar,
        custom_avatar_url: customAvatarUrl,
        referral_source: referralSource,
        onboarding_state: buildDraftState({
          step: 'youre_ready',
          username_draft: normalized,
        }),
      })
      .eq('id', userId)

    setSaving(false)
    if (updateError) {
      reportError(updateError.message, () => saveProfileAndContinue())
      return
    }

    setUsername(normalized)
    capturePostHog('onboarding_step_completed', { step: 'create_profile' })
    goToStep('youre_ready', 1)
  }

  const usernamePending = Boolean(userId) && !username.trim()
  const canSubmitProfile =
    !saving &&
    !usernamePending &&
    availability !== 'checking' &&
    availability !== 'taken' &&
    availability !== 'invalid'

  async function handleSelectAvatar(filename: string) {
    if (avatarSaving || uploadingAvatar) return
    if (!customAvatarUrl && filename === selectedAvatar) return

    const previousPreset = selectedAvatar
    const previousCustom = customAvatarUrl
    setAvatarSaving(filename)
    setSelectedAvatar(filename)
    setCustomAvatarUrl(null)
    clearErrorBanner()

    if (preview) {
      setAvatarSaving(null)
      return
    }

    if (!userId) {
      setAvatarSaving(null)
      return
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        avatar: filename,
        custom_avatar_url: null,
        onboarding_state: buildDraftState({ avatar_touched: true }),
      })
      .eq('id', userId)

    setAvatarSaving(null)
    if (updateError) {
      setSelectedAvatar(previousPreset)
      setCustomAvatarUrl(previousCustom)
      reportError(updateError.message, () => handleSelectAvatar(filename))
    }
  }

  async function handleAvatarFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploadingAvatar || avatarSaving) return

    if (preview) {
      reportError('Avatar upload is disabled in preview mode.')
      return
    }

    setUploadingAvatar(true)
    clearErrorBanner()
    const { publicUrl, error: uploadError } = await uploadCurrentUserAvatar(
      supabase,
      file,
    )
    setUploadingAvatar(false)

    if (uploadError || !publicUrl) {
      reportError(uploadError ?? 'Upload failed')
      return
    }
    setCustomAvatarUrl(publicUrl)
  }

  async function handlePrimaryProceed() {
    if (isSliding) return
    if (step === 'referral_source') {
      if (!referralSource) {
        reportError('Pick one option to continue.')
        return
      }
      capturePostHog('onboarding_step_completed', {
        step: 'referral_source',
        referral_source: referralSource,
      })
      const following = nextStep('referral_source')
      if (!following) return
      if (preview) {
        goToStep(following, 1)
        return
      }
      setSaving(true)
      clearErrorBanner()
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            referral_source: referralSource,
            onboarding_state: buildDraftState({ step: following }),
          })
          .eq('id', userId)
        if (updateError) throw new Error(updateError.message)
        goToStep(following, 1)
      } catch (err) {
        reportError(
          err instanceof Error ? err.message : 'Could not save',
          () => handlePrimaryProceed(),
        )
      } finally {
        setSaving(false)
      }
      return
    }

    if (step === 'create_profile') {
      await saveProfileAndContinue()
      return
    }

    if (step === 'youre_ready') {
      return
    }

    await advanceFrom(step)
  }

  const chromeStep = slideTarget ?? step
  const progress =
    ((stepIndex(chromeStep) + 1) / ONBOARDING_STEPS.length) * 100
  const priorStep = previousStep(step)
  const canGoBack = Boolean(priorStep)

  function renderChromeActions(
    forStep: OnboardingStepId,
    opts?: { desktop?: boolean },
  ) {
    const disabled =
      saving ||
      isSliding ||
      (forStep === 'referral_source' && !referralSource) ||
      (forStep === 'create_profile' && !canSubmitProfile)

    if (forStep === 'youre_ready') {
      return (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            className={cn('w-full', opts?.desktop && ONBOARDING_BTN_3D_PRIMARY)}
            disabled={saving || isSliding}
            onClick={() =>
              void completeOnboarding('completed', JOIN_POOL_HREF)
            }
          >
            {saving ? 'Finishing…' : 'Join a pool'}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full"
            disabled={saving || isSliding}
            onClick={() =>
              void completeOnboarding('completed', CREATE_POOL_HREF)
            }
          >
            Create a pool
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={saving || isSliding}
            onClick={() =>
              void completeOnboarding('completed', EXPLORE_HREF)
            }
          >
            Explore PoolCup
          </Button>
        </div>
      )
    }

    return (
      <Button
        type="button"
        size="lg"
        className={cn(
          'w-full',
          ONBOARDING_BTN_3D_PRIMARY,
          disabled && !saving && !isSliding && 'disabled:opacity-50',
        )}
        disabled={disabled}
        onClick={() => void handlePrimaryProceed()}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          'Continue'
        )}
      </Button>
    )
  }

  function renderNavRow(forStep: OnboardingStepId) {
    const continueDisabled =
      saving ||
      isSliding ||
      (forStep === 'referral_source' && !referralSource) ||
      (forStep === 'create_profile' && !canSubmitProfile)

    return (
      <>
        <div className="flex w-full items-stretch gap-3 pb-1.5 pr-1.5 [-webkit-tap-highlight-color:transparent]">
          <Button
            type="button"
            size="lg"
            className={cn(
              'w-[38%] min-w-0 shrink-0',
              ONBOARDING_BTN_3D_BACK,
              !canGoBack && 'disabled:opacity-50',
            )}
            disabled={!canGoBack || saving || isSliding}
            onClick={() => goPrevious()}
          >
            Back
          </Button>
          <div className="min-w-0 flex-1">
            {forStep === 'youre_ready' ? (
              <Button
                type="button"
                size="lg"
                className={cn('w-full', ONBOARDING_BTN_3D_PRIMARY)}
                disabled={saving || isSliding}
                onClick={() =>
                  void completeOnboarding('completed', JOIN_POOL_HREF)
                }
              >
                {saving ? 'Finishing…' : 'Join a pool'}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                className={cn(
                  'w-full',
                  ONBOARDING_BTN_3D_PRIMARY,
                  continueDisabled &&
                    !saving &&
                    !isSliding &&
                    'disabled:opacity-50',
                )}
                disabled={continueDisabled}
                onClick={() => void handlePrimaryProceed()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            )}
          </div>
        </div>
        {forStep === 'youre_ready' ? (
          <>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full"
              disabled={saving || isSliding}
              onClick={() =>
                void completeOnboarding('completed', CREATE_POOL_HREF)
              }
            >
              Create a pool
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={saving || isSliding}
              onClick={() =>
                void completeOnboarding('completed', EXPLORE_HREF)
              }
            >
              Explore PoolCup
            </Button>
          </>
        ) : null}
      </>
    )
  }

  function renderStepPanel(panelStep: OnboardingStepId) {
    const infoSlide = INFO_SLIDES.find((slide) => slide.id === panelStep)
    const mascotSrc = ONBOARDING_MASCOT_SRC[panelStep]
    const isSelectionSlide = panelStep === 'referral_source'

    const headlineBlock = (
      <div className="w-full shrink-0 px-0.5">
            {error && panelStep === step ? (
              <div
                className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                <p>{error}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {canRetry ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => void handleRetry()}
                    >
                      Try again
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => clearErrorBanner()}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}

            {infoSlide ? (
              <section
                className={cn(
                  'text-center lg:text-left',
                  infoSlide.id === 'welcome' ? 'space-y-2.5' : null,
                )}
              >
                {infoSlide.id === 'welcome' ? (
                  <div className="mx-auto flex w-fit flex-col items-center gap-2.5 lg:mx-0">
                    <h1 className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] sm:text-4xl">
                      {infoSlide.title}
                    </h1>
                    <div className="flex justify-center">
                      <Image
                        src={POOLCUP_LOGO_SRC}
                        alt="PoolCup"
                        width={260}
                        height={90}
                        unoptimized
                        priority
                        className="h-[3.75rem] w-auto max-w-[min(100%,15.75rem)] object-contain min-[380px]:h-[4.125rem] min-[380px]:max-w-[min(100%,18rem)] sm:h-[5.25rem] sm:max-w-[min(100%,21rem)] md:h-24 md:max-w-[min(100%,24rem)]"
                      />
                    </div>
                  </div>
                ) : (
                  <h1 className={ONBOARDING_TITLE_CLASS}>
                    {infoSlide.title}
                  </h1>
                )}
              </section>
            ) : null}

            {panelStep === 'referral_source' ? (
              <h1 className={ONBOARDING_TITLE_CLASS}>
                How did you hear about us?
              </h1>
            ) : null}

            {panelStep === 'create_profile' ? (
              <h1 className={ONBOARDING_TITLE_CLASS}>
                Create Your Profile
              </h1>
            ) : null}

            {panelStep === 'youre_ready' ? (
              <h1 className={ONBOARDING_TITLE_CLASS}>
                You&apos;re Ready
              </h1>
            ) : null}
      </div>
    )

    const descriptionBlock =
      infoSlide && infoSlide.id !== 'welcome' ? (
        <p className="mx-auto w-full max-w-md shrink-0 px-0.5 text-center text-base text-muted-foreground sm:text-lg lg:mx-0 lg:max-w-lg lg:text-left">
          {infoSlide.body}
        </p>
      ) : panelStep === 'referral_source' ? (
        <p className="mx-auto w-full shrink-0 px-0.5 text-center text-sm text-muted-foreground lg:mx-0 lg:text-left">
          Pick one — it helps us understand where PoolCup fans come from.
        </p>
      ) : panelStep === 'youre_ready' ? (
        <p className="mx-auto w-full max-w-md shrink-0 px-0.5 text-center text-base text-muted-foreground sm:text-lg lg:mx-0 lg:max-w-lg lg:text-left">
          Jump into a pool, start your own, or explore the app — your call.
        </p>
      ) : null

    const controlsBlock = (
      <div className="w-full shrink-0 px-0.5">
            {panelStep === 'referral_source' ? (
              <div
                className="flex flex-wrap justify-center gap-1.5 sm:gap-2 lg:justify-start"
                role="radiogroup"
                aria-label="Referral source"
              >
                  {ONBOARDING_REFERRAL_OPTIONS.map((option) => {
                    const selected = referralSource === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setReferralSource(option.id)
                          clearErrorBanner()
                        }}
                        className={pillClass(selected)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
              </div>
            ) : null}

            {panelStep === 'create_profile' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="onboarding-username"
                    className="text-sm font-medium"
                  >
                    Username
                  </label>
                  <Input
                    id="onboarding-username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) =>
                      setUsername(normalizeUsernameInput(e.target.value))
                    }
                    placeholder={
                      usernamePending ? 'Loading…' : 'your_username'
                    }
                    disabled={usernamePending}
                    aria-invalid={Boolean(usernameError)}
                    aria-describedby="onboarding-username-assigned onboarding-username-hint"
                    className="text-foreground caret-foreground [-webkit-text-fill-color:var(--foreground)] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--foreground)]"
                  />
                  {usernamePending ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden
                      />
                      Loading your username…
                    </p>
                  ) : null}
                  <p
                    id="onboarding-username-assigned"
                    className="text-xs text-muted-foreground"
                  >
                    This is your assigned username — feel free to change it.
                  </p>
                  <p
                    id="onboarding-username-hint"
                    className="text-xs text-muted-foreground"
                  >
                    {USERNAME_RULES_HINT}
                  </p>
                  {availability === 'checking' ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden
                      />
                      Checking availability…
                    </p>
                  ) : null}
                  {availability === 'available' && !usernameError ? (
                    <p className="text-xs text-primary" role="status">
                      Available
                    </p>
                  ) : null}
                  {usernameError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {usernameError}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Choose your avatar</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) =>
                      void handleAvatarFileSelected(event)
                    }
                  />
                  <div
                    className="grid grid-cols-4 gap-2"
                    role="radiogroup"
                    aria-label="Choose your avatar"
                  >
                    {availableAvatars.map((filename) => {
                      const isSelected =
                        !customAvatarUrl && selectedAvatar === filename
                      return (
                        <button
                          key={filename}
                          type="button"
                          role="radio"
                          onClick={() => void handleSelectAvatar(filename)}
                          disabled={Boolean(avatarSaving) || uploadingAvatar}
                          className={cn(
                            'aspect-square w-full overflow-hidden rounded-xl border p-1 transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-card hover:border-primary/40',
                          )}
                          aria-label={`Select avatar ${filename}`}
                          aria-checked={isSelected}
                        >
                          <UserAvatarImage
                            avatar={filename}
                            className="h-full w-full"
                            imgClassName="object-contain object-bottom p-0.5"
                          />
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      role="radio"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar || Boolean(avatarSaving)}
                      className={cn(
                        'aspect-square w-full overflow-hidden rounded-xl border transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        uploadingAvatar
                          ? 'flex items-center justify-center border-border bg-card'
                          : customAvatarUrl
                            ? 'border-primary bg-primary/10 p-1'
                            : 'flex flex-col items-center justify-center gap-0.5 border-dashed border-border bg-card px-1 hover:border-primary/40',
                      )}
                      aria-label={
                        customAvatarUrl
                          ? 'Your uploaded photo. Click to replace.'
                          : 'Upload a photo'
                      }
                      aria-checked={Boolean(customAvatarUrl)}
                    >
                      {uploadingAvatar ? (
                        <Loader2
                          className="h-5 w-5 animate-spin text-muted-foreground"
                          aria-hidden
                        />
                      ) : customAvatarUrl ? (
                        <UserAvatarImage
                          avatar={selectedAvatar}
                          customAvatarUrl={customAvatarUrl}
                          className="h-full w-full"
                          imgClassName="object-cover"
                        />
                      ) : (
                        <>
                          <Plus
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="text-[10px] font-medium leading-tight text-muted-foreground sm:text-xs">
                            Upload
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Favorite sports</p>
                  <p className="text-xs text-muted-foreground">
                    Optional — you can change these later.
                  </p>
                  <div
                    className="grid grid-cols-2 gap-2"
                    role="group"
                    aria-label="Favorite sports"
                  >
                    {ONBOARDING_SPORT_OPTIONS.map((sport) => {
                      const selected = favoriteSports.includes(sport.id)
                      return (
                        <button
                          key={sport.id}
                          type="button"
                          onClick={() => toggleSport(sport.id)}
                          aria-pressed={selected}
                          className={cn(
                            'flex h-12 w-full items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors sm:h-14',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            selected
                              ? 'border-primary bg-primary/15 text-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                          )}
                        >
                          <Image
                            src={sport.ballSrc}
                            alt=""
                            width={24}
                            height={24}
                            className="h-6 w-6 shrink-0 object-contain"
                          />
                          <span className="min-w-0 flex-1 truncate text-left">
                            {sport.label}
                          </span>
                          {selected ? (
                            <Check
                              className="h-3.5 w-3.5 shrink-0 text-primary"
                              strokeWidth={3}
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
      </div>
    )

    /**
     * Mobile: title → visual → copy → pills (unchanged).
     * Desktop (lg+): left column = copy + actions; right = visual.
     * One mascot instance per panel so slide remounts stay avoided.
     */
    const visualInner =
      panelStep === 'sports_identity' ? (
        <SportBallsOrbit priority />
      ) : mascotSrc ? (
        <OnboardingMascot
          src={mascotSrc}
          priority
          compact={panelStep !== 'welcome'}
          hero={panelStep === 'welcome'}
          tight={panelStep === 'referral_source'}
        />
      ) : null

    const isWelcome = panelStep === 'welcome'

    const visual = visualInner ? (
      <div
        className={cn(
          'flex shrink-0 justify-center',
          isWelcome ? 'max-lg:order-2' : 'max-lg:order-1',
          'lg:h-full lg:items-center lg:justify-center',
        )}
      >
        {visualInner}
      </div>
    ) : null

    const welcomeBody =
      panelStep === 'welcome' && infoSlide ? (
        <p className="mx-auto w-full max-w-md shrink-0 px-0.5 text-center text-sm text-muted-foreground sm:text-base lg:mx-0 lg:max-w-lg lg:text-left">
          {infoSlide.body}
        </p>
      ) : null

    const copyBlock = welcomeBody ?? descriptionBlock

    const desktopChrome = (
      <div className="mb-6 hidden w-full shrink-0 justify-start px-0.5 lg:flex">
        <OnboardingDotStepper
          currentIndex={stepIndex(chromeStep)}
          total={ONBOARDING_STEPS.length}
          animate={!prefersReducedMotion}
        />
      </div>
    )

    const mobileDots = isWelcome ? null : (
      <div className="max-lg:order-2 flex justify-center px-0.5 lg:hidden">
        <OnboardingDotStepper
          currentIndex={stepIndex(chromeStep)}
          total={ONBOARDING_STEPS.length}
          animate={!prefersReducedMotion}
        />
      </div>
    )

    const desktopActions = (
      <div className="hidden w-full shrink-0 [-webkit-tap-highlight-color:transparent] lg:flex lg:flex-col lg:gap-2 lg:pb-1.5 lg:pr-1.5 lg:pt-8">
        {isWelcome ? (
          renderChromeActions(panelStep, { desktop: true })
        ) : (
          renderNavRow(panelStep)
        )}
      </div>
    )

    // Create Your Profile is a taller form — scroll the middle, keep chrome fixed.
    if (panelStep === 'create_profile') {
      return (
        <div className={PANEL_SHELL_CLASS}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-lg:contents lg:h-full lg:justify-center">
            <div
              className="max-lg:order-1 h-2 shrink-0 sm:h-3 lg:hidden"
              aria-hidden
            />
            {desktopChrome}
            {mobileDots}
            <div className="max-lg:order-3 scrollbar-none min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-3 pt-12 lg:max-h-full lg:flex-none lg:pb-0 lg:pt-0">
              {headlineBlock}
              <div className="h-6 shrink-0 lg:h-4" aria-hidden />
              {controlsBlock}
            </div>
            {desktopActions}
          </div>
          {visual}
          {visual ? (
            <div
              className={cn('max-lg:order-1', MOBILE_IMAGE_TO_DOTS_GAP_CLASS)}
              aria-hidden
            />
          ) : null}
        </div>
      )
    }

    return (
      <div className={PANEL_SHELL_CLASS}>
        <div className="flex min-h-0 flex-1 flex-col max-lg:contents lg:h-full lg:min-h-0 lg:justify-center">
            {desktopChrome}
            {mobileDots}
            {!isWelcome ? (
              <div
                className={cn('max-lg:order-2', MOBILE_DOTS_TO_TITLE_GAP_CLASS)}
                aria-hidden
              />
            ) : null}
            <div className="flex min-h-0 flex-col max-lg:contents lg:gap-6 lg:overflow-hidden">
            <div
              className="max-lg:order-1 h-2 shrink-0 sm:h-3 lg:hidden"
              aria-hidden
            />
            <div
              className={cn(
                'w-full shrink-0',
                isWelcome ? 'max-lg:order-1' : 'max-lg:order-3',
              )}
            >
              {headlineBlock}
            </div>
            {isWelcome ? (
              <div
                className="max-lg:order-1 min-h-1 flex-1 lg:hidden"
                aria-hidden
              />
            ) : null}
            {copyBlock ? (
              <>
                <div
                  className={cn(
                    'shrink-0 lg:hidden',
                    isWelcome
                      ? 'max-lg:order-3 h-5 sm:h-6'
                      : 'max-lg:order-4 h-6',
                  )}
                  aria-hidden
                />
                <div
                  className={cn(
                    'w-full shrink-0',
                    isWelcome ? 'max-lg:order-3' : 'max-lg:order-4',
                  )}
                >
                  {copyBlock}
                </div>
              </>
            ) : null}
            {!isWelcome && isSelectionSlide ? (
              <div
                className={cn('max-lg:order-4', MOBILE_GROUP_GAP_CLASS)}
                aria-hidden
              />
            ) : null}
            {isSelectionSlide ? (
              <div className="max-lg:order-5 w-full shrink-0">
                {controlsBlock}
              </div>
            ) : null}
            <div
              className={cn(
                'min-h-1 flex-1 lg:hidden',
                isWelcome ? 'max-lg:order-3' : 'max-lg:order-6',
              )}
              aria-hidden
            />
          </div>
          {desktopActions}
        </div>
        {visual}
        {!isWelcome && visual ? (
          <div
            className={cn('max-lg:order-1', MOBILE_IMAGE_TO_DOTS_GAP_CLASS)}
            aria-hidden
          />
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden"
      style={ONBOARDING_BTN_MOTION_VARS}
      onPointerDownCapture={(event) => bindTactilePress(event.target)}
    >
      <div
        className="h-[3px] w-full shrink-0 bg-muted"
        aria-hidden
      >
        <div
          className={cn(
            'h-full bg-[#00e676]',
            !prefersReducedMotion &&
              'transition-[width] duration-200 ease-in-out',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-4 lg:max-w-6xl lg:px-10 lg:pt-10 xl:max-w-7xl xl:px-12">
      <header
        className={cn(
          'shrink-0 pt-6 sm:pt-8 lg:hidden',
          // Keep the Welcome title's top offset on later slides (invisible, still in flow).
          step !== 'welcome' && 'invisible pointer-events-none',
        )}
        aria-hidden={step !== 'welcome'}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => goPrevious()}
            disabled={
              step !== 'welcome' || !canGoBack || saving || isSliding
            }
            aria-label="Go back"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              canGoBack
                ? 'hover:bg-muted'
                : 'pointer-events-none opacity-0',
            )}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1" aria-hidden />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="flex h-full min-h-0 w-[200%] flex-1 will-change-transform"
          style={{
            transform: `translateX(${trackX}%)`,
            ...slideMotionStyle('transform', trackTransition),
          }}
        >
          <div
            key="onboarding-panel-left"
            className={cn(
              'flex h-full min-h-0 w-1/2 shrink-0 flex-col',
              isSliding && 'pointer-events-none will-change-[opacity]',
            )}
            style={{
              opacity: leftOpacity,
              ...slideMotionStyle('opacity', trackTransition),
            }}
          >
            {renderStepPanel(leftPanelStep)}
          </div>
          <div
            key="onboarding-panel-right"
            className={cn(
              'pointer-events-none flex h-full min-h-0 w-1/2 shrink-0 flex-col',
              isSliding && 'will-change-[opacity]',
            )}
            style={{
              opacity: rightOpacity,
              ...slideMotionStyle('opacity', trackTransition),
            }}
            aria-hidden
          >
            {rightPanelStep ? renderStepPanel(rightPanelStep) : null}
          </div>
        </div>
      </div>

      <footer className="shrink-0 bg-background pb-3 pt-3 [-webkit-tap-highlight-color:transparent] lg:hidden">
        {step === 'welcome' ? (
          <div className="pb-1.5 pr-1.5 [-webkit-tap-highlight-color:transparent]">
            {renderChromeActions(step)}
          </div>
        ) : (
          renderNavRow(step)
        )}
      </footer>
    </main>
    <div className="h-12 shrink-0 lg:hidden" aria-hidden />
    </div>
  )
}
