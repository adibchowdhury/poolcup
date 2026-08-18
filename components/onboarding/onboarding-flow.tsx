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
} from 'react'
import { Check, ChevronLeft, Loader2, Plus } from 'lucide-react'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  CREATE_POOL_HREF,
  EXPLORE_HREF,
  JOIN_POOL_HREF,
  LOGIN_HREF,
  ONBOARDING_FAN_LEVEL_OPTIONS,
  ONBOARDING_MOTIVATION_LEVEL_OPTIONS,
  ONBOARDING_REFERRAL_OPTIONS,
  ONBOARDING_SPORT_OPTIONS,
  ONBOARDING_STEPS,
  isOnboardingFanLevel,
  isOnboardingMotivationLevel,
  nextStep,
  previousStep,
  resolveResumeStep,
  stepIndex,
  type OnboardingFanLevel,
  type OnboardingMotivationLevel,
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
  fanLevel: number | null
  motivationLevel: number | null
  onboardingState: OnboardingState
  nextPath: string
}

const USERNAME_DEBOUNCE_MS = 400
/** Full carousel slide duration (ms). */
const SLIDE_MS = 320

/**
 * Temp stand-in mascot for every step that shows Pucky.
 * sports_identity uses SportBallsOrbit instead; create_profile has no mascot.
 */
const PUCKY_TEMP_SRC = '/mascot/onboarding_mascot/original/pucky_temp.png'

const ONBOARDING_MASCOT_SRC: Partial<
  Record<OnboardingStepId, string>
> = {
  welcome: PUCKY_TEMP_SRC,
  predict_compete: PUCKY_TEMP_SRC,
  your_pool: PUCKY_TEMP_SRC,
  // sports_identity uses SportBallsOrbit instead of a mascot
  better_friends: PUCKY_TEMP_SRC,
  referral_source: PUCKY_TEMP_SRC,
  fan_level: PUCKY_TEMP_SRC,
  motivation_level: PUCKY_TEMP_SRC,
  youre_ready: PUCKY_TEMP_SRC,
}

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
  'relative mx-auto flex h-56 w-56 shrink-0 items-end justify-center sm:h-64 sm:w-64'
/** Selection slides: scaled down from hero just enough for wrapped pills at ~667px. */
const MASCOT_FRAME_COMPACT_CLASS =
  'relative mx-auto flex h-48 w-48 shrink-0 items-end justify-center sm:h-64 sm:w-64'
/** Welcome + value slides: shared hero frame. */
const MASCOT_FRAME_HERO_CLASS =
  'relative mx-auto flex h-[16.5rem] w-[16.5rem] shrink-0 items-end justify-center sm:h-[19.5rem] sm:w-[19.5rem]'
const MASCOT_IMAGE_CLASS =
  'h-full w-full object-contain object-bottom transition-opacity duration-200'

function OnboardingMascot({
  src,
  priority = false,
  compact = false,
  hero = false,
}: {
  src: string
  priority?: boolean
  compact?: boolean
  hero?: boolean
}) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [src])

  const frameClass = hero
    ? MASCOT_FRAME_HERO_CLASS
    : compact
      ? MASCOT_FRAME_COMPACT_CLASS
      : MASCOT_FRAME_CLASS

  return (
    <div className={frameClass}>
      {!loaded ? (
        <div
          className="absolute inset-0 animate-pulse rounded-2xl bg-muted/35"
          aria-hidden
        />
      ) : null}
      <Image
        src={src}
        alt=""
        width={MASCOT_INTRINSIC}
        height={MASCOT_INTRINSIC}
        sizes={
          hero
            ? '(min-width: 640px) 312px, 264px'
            : compact
              ? '(min-width: 640px) 256px, 192px'
              : '(min-width: 640px) 256px, 224px'
        }
        priority={priority}
        onLoad={() => setLoaded(true)}
        className={cn(
          MASCOT_IMAGE_CLASS,
          loaded ? 'opacity-100' : 'opacity-0',
        )}
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
      className={cn(MASCOT_FRAME_HERO_CLASS, 'overflow-hidden')}
      aria-hidden
    >
      <div className="animate-onboarding-sport-orbit absolute inset-0">
        {SPORT_ORBIT_BALLS.map((ball, index) => {
          const angle = (360 / count) * index
          return (
            <div
              key={ball.src}
              className="absolute left-1/2 top-1/2 h-11 w-11 sm:h-12 sm:w-12"
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

const PILL_WRAP_CLASS =
  'flex-[1_1_calc(50%-0.375rem)] min-w-[9rem] max-w-full'

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
    body: 'Commissioners run the show — scoring style, announcements, polls, and tools to keep your league humming the way your group wants.',
  },
  {
    id: 'sports_identity',
    title: 'Build Your Sports Identity.',
    body: 'Your profile is your résumé — earn XP, unlock badges for streaks and milestones, and customize your look and favorites.',
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
  const [step, setStep] = useState<OnboardingStepId>(() =>
    preview && previewStep
      ? previewStep
      : resolveResumeStep(bootstrap.onboardingState),
  )
  /** Dual-panel carousel: track is 200% wide; translateX 0 or -50%. */
  const [isSliding, setIsSliding] = useState(false)
  const [trackX, setTrackX] = useState(0)
  const [trackTransition, setTrackTransition] = useState(false)
  const [leftPanelStep, setLeftPanelStep] = useState<OnboardingStepId | null>(
    null,
  )
  const [rightPanelStep, setRightPanelStep] = useState<OnboardingStepId | null>(
    null,
  )
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
  const [fanLevel, setFanLevel] = useState<OnboardingFanLevel | null>(() => {
    const fromState = bootstrap.onboardingState.fan_level
    if (isOnboardingFanLevel(fromState)) return fromState
    if (isOnboardingFanLevel(bootstrap.fanLevel)) return bootstrap.fanLevel
    return null
  })
  const [motivationLevel, setMotivationLevel] =
    useState<OnboardingMotivationLevel | null>(() => {
      const fromState = bootstrap.onboardingState.motivation_level
      if (isOnboardingMotivationLevel(fromState)) return fromState
      if (isOnboardingMotivationLevel(bootstrap.motivationLevel)) {
        return bootstrap.motivationLevel
      }
      return null
    })
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

  /** Prefetch the next slide's mascot so Continue transitions don't wait on fetch. */
  useEffect(() => {
    const following = nextStep(step)
    if (!following) return
    const src = ONBOARDING_MASCOT_SRC[following]
    if (!src) return

    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = src
    link.type = 'image/png'
    document.head.appendChild(link)

    // Also warm the browser decode cache.
    const img = new window.Image()
    img.src = src

    return () => {
      link.remove()
    }
  }, [step])

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
        syncPreviewUrl(next)
        return
      }

      // Forward: [current | next] at 0% â†’ -50%. Back: [prev | current] at -50% â†’ 0%.
      if (dir === 1) {
        setLeftPanelStep(step)
        setRightPanelStep(next)
        setTrackTransition(false)
        setTrackX(0)
      } else {
        setLeftPanelStep(next)
        setRightPanelStep(step)
        setTrackTransition(false)
        setTrackX(-50)
      }
      setSlideTarget(next)
      setIsSliding(true)

      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setTrackTransition(true)
          setTrackX(dir === 1 ? -50 : 0)
        })
      })

      const doneTimer = window.setTimeout(() => {
        setStep(next)
        syncPreviewUrl(next)
        setIsSliding(false)
        setSlideTarget(null)
        setLeftPanelStep(null)
        setRightPanelStep(null)
        setTrackTransition(false)
        setTrackX(0)
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
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
        fan_level: fanLevel ?? undefined,
        motivation_level: motivationLevel ?? undefined,
        ...partial,
      }
    },
    [
      bootstrap.onboardingState,
      fanLevel,
      favoriteSports,
      motivationLevel,
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
          fan_level: fanLevel ?? undefined,
          motivation_level: motivationLevel ?? undefined,
        },
        favorite_sports: favoriteSports,
      }
      if (normalizedUsername) profilePatch.username = normalizedUsername
      if (referralSource) profilePatch.referral_source = referralSource
      if (fanLevel != null) profilePatch.fan_level = fanLevel
      if (motivationLevel != null) profilePatch.motivation_level = motivationLevel
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
          ...(fanLevel != null ? { fan_level: fanLevel } : {}),
          ...(motivationLevel != null
            ? { motivation_level: motivationLevel }
            : {}),
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
      fanLevel,
      favoriteSports,
      motivationLevel,
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
        ...(from === 'fan_level' && fanLevel != null
          ? { fan_level: fanLevel }
          : {}),
        ...(from === 'motivation_level' && motivationLevel != null
          ? { motivation_level: motivationLevel }
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
        fan_level: fanLevel,
        motivation_level: motivationLevel,
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
      if (preview) {
        goToStep('fan_level', 1)
        return
      }
      setSaving(true)
      clearErrorBanner()
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            referral_source: referralSource,
            onboarding_state: buildDraftState({ step: 'fan_level' }),
          })
          .eq('id', userId)
        if (updateError) throw new Error(updateError.message)
        goToStep('fan_level', 1)
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

    if (step === 'fan_level') {
      if (fanLevel == null) {
        reportError('Pick one option to continue.')
        return
      }
      capturePostHog('onboarding_step_completed', {
        step: 'fan_level',
        fan_level: fanLevel,
      })
      if (preview) {
        goToStep('motivation_level', 1)
        return
      }
      setSaving(true)
      clearErrorBanner()
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            fan_level: fanLevel,
            onboarding_state: buildDraftState({ step: 'motivation_level' }),
          })
          .eq('id', userId)
        if (updateError) throw new Error(updateError.message)
        goToStep('motivation_level', 1)
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

    if (step === 'motivation_level') {
      if (motivationLevel == null) {
        reportError('Pick one option to continue.')
        return
      }
      capturePostHog('onboarding_step_completed', {
        step: 'motivation_level',
        motivation_level: motivationLevel,
      })
      if (preview) {
        goToStep('create_profile', 1)
        return
      }
      setSaving(true)
      clearErrorBanner()
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            motivation_level: motivationLevel,
            onboarding_state: buildDraftState({
              step: 'create_profile',
            }),
          })
          .eq('id', userId)
        if (updateError) throw new Error(updateError.message)
        goToStep('create_profile', 1)
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
  const primaryDisabled =
    saving ||
    isSliding ||
    (step === 'referral_source' && !referralSource) ||
    (step === 'fan_level' && fanLevel == null) ||
    (step === 'motivation_level' && motivationLevel == null) ||
    (step === 'create_profile' && !canSubmitProfile)

  const showProgress = step !== 'welcome'

  function renderStepPanel(panelStep: OnboardingStepId) {
    const infoSlide = INFO_SLIDES.find((slide) => slide.id === panelStep)
    const mascotSrc = ONBOARDING_MASCOT_SRC[panelStep]
    const isSelectionSlide =
      panelStep === 'referral_source' ||
      panelStep === 'fan_level' ||
      panelStep === 'motivation_level'

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
                  'text-center',
                  infoSlide.id === 'welcome' ? 'space-y-2.5' : null,
                )}
              >
                {infoSlide.id === 'welcome' ? (
                  <>
                    <h1 className="font-display text-3xl tracking-wide text-[#f0f4f8] sm:text-4xl">
                      {infoSlide.title}
                    </h1>
                    <div className="flex justify-center">
                      <Image
                        src={POOLCUP_LOGO_SRC}
                        alt="PoolCup"
                        width={260}
                        height={90}
                        priority={panelStep === step}
                        className="h-[3.75rem] w-auto max-w-[min(100%,15.75rem)] object-contain min-[380px]:h-[4.125rem] min-[380px]:max-w-[min(100%,18rem)] sm:h-[5.25rem] sm:max-w-[min(100%,21rem)] md:h-24 md:max-w-[min(100%,24rem)]"
                      />
                    </div>
                  </>
                ) : (
                  <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                    {infoSlide.title}
                  </h1>
                )}
              </section>
            ) : null}

            {panelStep === 'referral_source' ? (
              <h1 className="text-center font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                How did you hear about us?
              </h1>
            ) : null}

            {panelStep === 'fan_level' ? (
              <h1 className="text-center font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                What kind of sports fan are you?
              </h1>
            ) : null}

            {panelStep === 'motivation_level' ? (
              <h1 className="text-center font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                What&apos;s your goal on PoolCup?
              </h1>
            ) : null}

            {panelStep === 'create_profile' ? (
              <h1 className="text-center font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                Create Your Profile
              </h1>
            ) : null}

            {panelStep === 'youre_ready' ? (
              <h1 className="text-center font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                You&apos;re Ready
              </h1>
            ) : null}
      </div>
    )

    const descriptionBlock =
      infoSlide && infoSlide.id !== 'welcome' ? (
        <p className="mx-auto w-full max-w-md shrink-0 px-0.5 text-center text-base text-muted-foreground sm:text-lg">
          {infoSlide.body}
        </p>
      ) : panelStep === 'referral_source' ? (
        <p className="mx-auto w-full shrink-0 px-0.5 text-center text-sm text-muted-foreground">
          Pick one — it helps us understand where PoolCup fans come from.
        </p>
      ) : panelStep === 'fan_level' || panelStep === 'motivation_level' ? (
        <p className="mx-auto w-full shrink-0 px-0.5 text-center text-sm text-muted-foreground">
          Pick the option that fits you best.
        </p>
      ) : panelStep === 'youre_ready' ? (
        <p className="mx-auto w-full max-w-md shrink-0 px-0.5 text-center text-base text-muted-foreground sm:text-lg">
          Jump into a pool, start your own, or explore the app — your call.
        </p>
      ) : null

    const controlsBlock = (
      <div className="w-full shrink-0 px-0.5">
            {panelStep === 'referral_source' ? (
              <div
                className="flex flex-wrap justify-center gap-1.5 sm:gap-2"
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

            {panelStep === 'fan_level' ? (
              <div
                className="flex flex-wrap justify-center gap-1.5 sm:gap-2"
                role="radiogroup"
                aria-label="What kind of sports fan are you"
              >
                  {ONBOARDING_FAN_LEVEL_OPTIONS.map((option) => {
                    const selected = fanLevel === option.level
                    return (
                      <button
                        key={option.level}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setFanLevel(option.level)
                          clearErrorBanner()
                        }}
                        className={cn(pillClass(selected), PILL_WRAP_CLASS)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
              </div>
            ) : null}

            {panelStep === 'motivation_level' ? (
              <div
                className="flex flex-wrap justify-center gap-1.5 sm:gap-2"
                role="radiogroup"
                aria-label="What's your goal on PoolCup"
              >
                  {ONBOARDING_MOTIVATION_LEVEL_OPTIONS.map((option) => {
                    const selected = motivationLevel === option.level
                    return (
                      <button
                        key={option.level}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setMotivationLevel(option.level)
                          clearErrorBanner()
                        }}
                        className={cn(pillClass(selected), PILL_WRAP_CLASS)}
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
     * Vertical rhythm (content column between header and footer):
     *   [gap A] → visual → [gap A] → text → [gap B] → Continue
     * Welcome: "Welcome to" → logo → Pucky → description (unchanged).
     * Other slides: title → mascot / sport-balls (hero size; compact on pill
     * slides) → description → controls → Continue. Leftover flex around the
     * mascot on value slides matches Welcome's vertical placement.
     */
    const visual =
      panelStep === 'sports_identity' ? (
        <div className="flex shrink-0 justify-center">
          <SportBallsOrbit priority={panelStep === step} />
        </div>
      ) : mascotSrc ? (
        <div className="flex shrink-0 justify-center">
          <OnboardingMascot
            src={mascotSrc}
            priority={panelStep === step}
            compact={isSelectionSlide}
            hero={!isSelectionSlide}
          />
        </div>
      ) : null

    // Create Your Profile is a taller form — scroll the middle, keep chrome fixed.
    if (panelStep === 'create_profile') {
      return (
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="scrollbar-none min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-3 pt-5 sm:pt-6">
            {headlineBlock}
            <div className="h-4 shrink-0" aria-hidden />
            {controlsBlock}
          </div>
        </div>
      )
    }

    // Welcome: headline + logo near the top; leftover between logo and Pucky
    // and below the description. Extra pad between Pucky and description.
    if (panelStep === 'welcome') {
      return (
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="h-2 shrink-0 sm:h-3" aria-hidden />
          {headlineBlock}
          <div className="min-h-1 flex-1" aria-hidden />
          {visual}
          <div className="h-5 shrink-0 sm:h-6" aria-hidden />
          {infoSlide ? (
            <p className="mx-auto w-full max-w-md shrink-0 px-0.5 text-center text-sm text-muted-foreground sm:text-base">
              {infoSlide.body}
            </p>
          ) : null}
          <div className="min-h-1 flex-1" aria-hidden />
        </div>
      )
    }

    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="h-5 shrink-0 sm:h-7" aria-hidden />
        {headlineBlock}
        {visual ? (
          <>
            {isSelectionSlide ? (
              <div className="h-3 shrink-0 sm:h-4" aria-hidden />
            ) : (
              <div className="min-h-1 flex-1" aria-hidden />
            )}
            {visual}
          </>
        ) : null}
        {descriptionBlock ? (
          <>
            <div className="h-4 shrink-0 sm:h-5" aria-hidden />
            {descriptionBlock}
          </>
        ) : null}
        {isSelectionSlide ? (
          <>
            <div className="h-3 shrink-0 sm:h-4" aria-hidden />
            {controlsBlock}
          </>
        ) : null}
        <div className="min-h-1 flex-1" aria-hidden />
      </div>
    )
  }

  return (
    <main className="mx-auto flex h-dvh max-h-dvh w-full max-w-lg flex-col overflow-hidden px-4">
      <header className="shrink-0 pt-6 sm:pt-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => goPrevious()}
            disabled={!canGoBack || saving || isSliding}
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
          {showProgress ? (
            <div
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={stepIndex(chromeStep) + 1}
              aria-valuemin={1}
              aria-valuemax={ONBOARDING_STEPS.length}
              aria-label={`Step ${stepIndex(chromeStep) + 1} of ${ONBOARDING_STEPS.length}`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : (
            <div className="min-w-0 flex-1" aria-hidden />
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {isSliding && leftPanelStep && rightPanelStep ? (
          <div
            className={cn(
              'flex min-h-0 h-full w-[200%] will-change-transform',
              trackTransition &&
                'transition-transform duration-[320ms] ease-in-out',
            )}
            style={{ transform: `translateX(${trackX}%)` }}
            aria-hidden
          >
            <div className="pointer-events-none flex h-full min-h-0 w-1/2 shrink-0 flex-col">
              {renderStepPanel(leftPanelStep)}
            </div>
            <div className="pointer-events-none flex h-full min-h-0 w-1/2 shrink-0 flex-col">
              {renderStepPanel(rightPanelStep)}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 w-full flex-1 flex-col">
            {renderStepPanel(step)}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-white/[0.06] bg-background pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {step === 'youre_ready' ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full"
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
        ) : step === 'welcome' ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full font-semibold text-white"
              disabled={primaryDisabled}
              onClick={() => void handlePrimaryProceed()}
            >
              Get Started
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full"
              disabled={saving || isSliding}
              onClick={() => router.push(LOGIN_HREF)}
            >
              I already have an account
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={primaryDisabled}
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
      </footer>
    </main>
  )
}
