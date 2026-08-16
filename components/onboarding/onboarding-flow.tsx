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
import { ChevronLeft, Loader2, Upload } from 'lucide-react'
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
import {
  DISPLAY_NAME_MAX_LENGTH,
  validateDisplayName,
} from '@/src/lib/ugc-limits'
import {
  clearCurrentUserCustomAvatar,
  uploadCurrentUserAvatar,
} from '@/src/lib/upload-user-avatar'
import {
  checkUsernameAvailable,
  ensureDefaultUsername,
  getUsernameFormatError,
  normalizeUsernameInput,
  usernameFormatErrorMessage,
  USERNAME_RULES_HINT,
} from '@/src/lib/username'

export type OnboardingBootstrap = {
  userId: string
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
/** Full carousel slide duration (ms). */
const SLIDE_MS = 320
/** Reserved region under the progress bar for the Pucky mascot. */
const MASCOT_RESERVE_CLASS =
  'relative flex h-28 shrink-0 items-end justify-center sm:h-32'
const PUCKY_HERO_SRC = '/mascot/pucky_hero.png'

/** Steps that show Pucky in the top reserve (skip dense create_profile). */
const STEPS_WITH_MASCOT = new Set<OnboardingStepId>([
  'welcome',
  'predict_compete',
  'your_pool',
  'sports_identity',
  'better_friends',
  'referral_source',
  'youre_ready',
])

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
  bullets?: string[]
}

const INFO_SLIDES: InfoSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to PoolCup',
    body: 'The prediction game built for friends, offices, and rivalries â€” private pools, live standings, and bragging rights.',
  },
  {
    id: 'predict_compete',
    title: 'Predict. Compete. Climb.',
    body: 'Create or join a pool, lock in your picks before kickoff, and watch the live leaderboard move with every result.',
    bullets: [
      'Join with an invite or discover official pools',
      'Exact-score or winner-only prediction styles',
      'Standings that update as matches finish',
    ],
  },
  {
    id: 'your_pool',
    title: 'Your Pool. Your Rules.',
    body: 'Commissioners run the show â€” scoring style, announcements, polls, and tools to keep your league humming.',
    bullets: [
      'Set the rules your group actually wants',
      'Keep members in the loop with announcements',
      'Run polls and manage the competition',
    ],
  },
  {
    id: 'sports_identity',
    title: 'Build Your Sports Identity.',
    body: 'Your profile is your rÃ©sumÃ© â€” XP, badges, favorites, and a look that feels like you.',
    bullets: [
      'Earn XP and level up as you play',
      'Unlock badges for streaks and milestones',
      'Customize your avatar and favorites',
    ],
  },
  {
    id: 'better_friends',
    title: 'Better With Friends.',
    body: 'Add friends, chat about the slate, and turn every matchweek into a social competition.',
    bullets: [
      'Find friends and climb shared leaderboards',
      'Chat about picks and rivalries',
      'Compete beyond a single pool',
    ],
  },
]

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
  const [username, setUsername] = useState(
    () =>
      bootstrap.onboardingState.username_draft ??
      bootstrap.username ??
      '',
  )
  const [displayName, setDisplayName] = useState(
    () =>
      bootstrap.onboardingState.display_name_draft ??
      bootstrap.displayName ??
      '',
  )
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
  const [displayNameError, setDisplayNameError] = useState<string | null>(null)
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
    if (startedRef.current) return
    startedRef.current = true
    if (preview) return
    capturePostHog('onboarding_started')
  })

  useEffect(() => {
    onStarted()
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
      if (bootstrap.username?.trim()) return
      const { username: generated, error: genError } = await ensureDefaultUsername(
        supabase,
        bootstrap.userId,
      )
      if (cancelled) return
      if (generated) {
        setUsername((prev) => prev || generated)
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
  }, [bootstrap.userId, bootstrap.username])

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
    (partial: OnboardingState = {}): OnboardingState => ({
      ...bootstrap.onboardingState,
      step,
      favorite_sports: favoriteSports,
      username_draft: username || undefined,
      display_name_draft: displayName.trim() || undefined,
      referral_source: referralSource ?? undefined,
      ...partial,
    }),
    [
      bootstrap.onboardingState,
      displayName,
      favoriteSports,
      referralSource,
      step,
      username,
    ],
  )

  const persistState = useCallback(
    async (partial: OnboardingState = {}) => {
      const nextState = buildDraftState(partial)
      if (preview) return nextState
      const { error: updateError } = await supabase
        .from('users')
        .update({ onboarding_state: nextState })
        .eq('id', bootstrap.userId)
      if (updateError) throw new Error(updateError.message)
      return nextState
    },
    [bootstrap.userId, buildDraftState, preview],
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

      setSaving(true)
      clearErrorBanner()

      const normalizedUsername = normalizeUsernameInput(username)
      const trimmedDisplay = displayName.trim()
      const profilePatch: Record<string, unknown> = {
        onboarding_completed: true,
        onboarding_state: {
          step: 'done',
          favorite_sports: favoriteSports,
          username_draft: normalizedUsername || undefined,
          display_name_draft: trimmedDisplay || undefined,
          referral_source: referralSource ?? undefined,
        },
        favorite_sports: favoriteSports,
      }
      if (normalizedUsername) profilePatch.username = normalizedUsername
      if (trimmedDisplay) profilePatch.display_name = trimmedDisplay
      if (referralSource) profilePatch.referral_source = referralSource
      if (selectedAvatar) profilePatch.avatar = selectedAvatar
      if (customAvatarUrl !== undefined) {
        profilePatch.custom_avatar_url = customAvatarUrl
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(profilePatch)
        .eq('id', bootstrap.userId)

      setSaving(false)
      if (updateError) {
        reportError(updateError.message, () =>
          completeOnboarding(mode, redirectTo).then(() => undefined),
        )
        return false
      }

      capturePostHog(
        mode === 'skipped' ? 'onboarding_skipped' : 'onboarding_completed',
        referralSource ? { referral_source: referralSource } : undefined,
      )
      const { awardClientXp } = await import('@/src/lib/xp-client')
      await awardClientXp({ sourceType: 'onboarding_complete' })
      router.replace(redirectTo ?? bootstrap.nextPath)
      return true
    },
    [
      bootstrap.nextPath,
      bootstrap.userId,
      customAvatarUrl,
      displayName,
      favoriteSports,
      preview,
      referralSource,
      router,
      selectedAvatar,
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
    if (step !== 'create_profile') return
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
          bootstrap.userId,
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
  }, [username, step, bootstrap.userId])

  async function saveProfileAndContinue() {
    const normalized = normalizeUsernameInput(username)
    const formatError = getUsernameFormatError(normalized)
    if (formatError) {
      setUsernameError(usernameFormatErrorMessage(formatError))
      setAvailability('invalid')
      return
    }

    const nameError = validateDisplayName(displayName)
    if (nameError) {
      setDisplayNameError(nameError)
      return
    }
    if (!displayName.trim()) {
      setDisplayNameError('Enter your full name.')
      return
    }
    setDisplayNameError(null)

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

    setSaving(true)
    clearErrorBanner()

    const { available, error: availError } = await checkUsernameAvailable(
      supabase,
      normalized,
      bootstrap.userId,
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

    const trimmedDisplay = displayName.trim()
    const { error: updateError } = await supabase
      .from('users')
      .update({
        username: normalized,
        display_name: trimmedDisplay,
        favorite_sports: favoriteSports,
        avatar: selectedAvatar,
        custom_avatar_url: customAvatarUrl,
        referral_source: referralSource,
        onboarding_state: buildDraftState({
          step: 'youre_ready',
          username_draft: normalized,
          display_name_draft: trimmedDisplay,
        }),
      })
      .eq('id', bootstrap.userId)

    setSaving(false)
    if (updateError) {
      reportError(updateError.message, () => saveProfileAndContinue())
      return
    }

    setUsername(normalized)
    capturePostHog('onboarding_step_completed', { step: 'create_profile' })
    goToStep('youre_ready', 1)
  }

  const canSubmitProfile =
    !saving &&
    availability !== 'checking' &&
    availability !== 'taken' &&
    availability !== 'invalid' &&
    Boolean(displayName.trim()) &&
    !displayNameError

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

    const { error: updateError } = await supabase
      .from('users')
      .update({
        avatar: filename,
        custom_avatar_url: null,
        onboarding_state: buildDraftState({ avatar_touched: true }),
      })
      .eq('id', bootstrap.userId)

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

  async function handleRemoveCustomAvatar() {
    if (!customAvatarUrl || uploadingAvatar) return
    const previous = customAvatarUrl
    setCustomAvatarUrl(null)
    clearErrorBanner()

    if (preview) return

    const { error: clearError } = await clearCurrentUserCustomAvatar(
      supabase,
      bootstrap.userId,
    )
    if (clearError) {
      setCustomAvatarUrl(previous)
      reportError(clearError, () => handleRemoveCustomAvatar())
    }
  }

  async function handlePrimaryProceed() {
    if (isSliding) return
    if (step === 'referral_source') {
      if (!referralSource) {
        reportError('Pick one option to continue.')
        return
      }
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
            referral_source: referralSource,
            onboarding_state: buildDraftState({ step: 'create_profile' }),
          })
          .eq('id', bootstrap.userId)
        if (updateError) throw new Error(updateError.message)
        capturePostHog('onboarding_step_completed', {
          step: 'referral_source',
          referral_source: referralSource,
        })
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
    (step === 'create_profile' && !canSubmitProfile)

  function renderStepPanel(panelStep: OnboardingStepId) {
    const infoSlide = INFO_SLIDES.find((slide) => slide.id === panelStep)
    const showMascot = STEPS_WITH_MASCOT.has(panelStep)

    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className={MASCOT_RESERVE_CLASS} aria-hidden={!showMascot}>
          {showMascot ? (
            <Image
              src={PUCKY_HERO_SRC}
              alt=""
              width={160}
              height={160}
              priority={panelStep === step}
              className="h-[6.5rem] w-auto object-contain object-bottom sm:h-28"
            />
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <div
            className={cn(
              'flex flex-1 flex-col px-0.5',
              panelStep === 'create_profile' || panelStep === 'referral_source'
                ? 'justify-start pb-4 pt-1'
                : 'justify-center py-2',
            )}
          >
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
              <section className="space-y-4 text-center">
                <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                  {infoSlide.title}
                </h1>
                <p className="text-base text-muted-foreground sm:text-lg">
                  {infoSlide.body}
                </p>
                {infoSlide.bullets?.length ? (
                  <ul className="mx-auto max-w-sm space-y-2 text-left text-sm text-foreground/90">
                    {infoSlide.bullets.map((item) => (
                      <li key={item}>â€¢ {item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {panelStep === 'referral_source' ? (
              <section className="w-full space-y-4">
                <div className="text-center">
                  <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                    How did you hear about us?
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pick one â€” it helps us understand where PoolCup fans come
                    from.
                  </p>
                </div>
                <div
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
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
                        className={cn(
                          'rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          selected
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {panelStep === 'create_profile' ? (
              <section className="w-full space-y-6">
                <div className="text-center">
                  <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                    Create Your Profile
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Set your handle, name, look, and favorite sports.
                  </p>
                </div>

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
                    placeholder="swiftstriker42"
                    aria-invalid={Boolean(usernameError)}
                    aria-describedby="onboarding-username-hint"
                  />
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
                      Checking availabilityâ€¦
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
                  <label
                    htmlFor="onboarding-display-name"
                    className="text-sm font-medium"
                  >
                    Full name
                  </label>
                  <Input
                    id="onboarding-display-name"
                    autoComplete="name"
                    value={displayName}
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    onChange={(e) => {
                      setDisplayName(e.target.value)
                      setDisplayNameError(null)
                    }}
                    placeholder="Alex Rivera"
                    aria-invalid={Boolean(displayNameError)}
                  />
                  {displayNameError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {displayNameError}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Avatar</p>
                  <div className="flex flex-col items-center gap-3">
                    <UserAvatarImage
                      avatar={selectedAvatar}
                      customAvatarUrl={customAvatarUrl}
                      className="h-24 w-24 border border-border"
                      imgClassName={
                        customAvatarUrl
                          ? 'object-cover'
                          : 'object-contain object-bottom p-1'
                      }
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) =>
                        void handleAvatarFileSelected(event)
                      }
                    />
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={uploadingAvatar || Boolean(avatarSaving)}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" aria-hidden />
                        {uploadingAvatar ? 'Uploadingâ€¦' : 'Upload photo'}
                      </Button>
                      {customAvatarUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={uploadingAvatar}
                          onClick={() => void handleRemoveCustomAvatar()}
                        >
                          Remove custom
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {availableAvatars.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">
                      Loading presetsâ€¦
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                      {availableAvatars.map((filename) => {
                        const isSelected =
                          !customAvatarUrl && selectedAvatar === filename
                        return (
                          <button
                            key={filename}
                            type="button"
                            onClick={() => void handleSelectAvatar(filename)}
                            disabled={Boolean(avatarSaving) || uploadingAvatar}
                            className={cn(
                              'overflow-hidden rounded-xl border p-1 transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-card hover:border-primary/40',
                            )}
                            aria-label={`Select avatar ${filename}`}
                            aria-pressed={isSelected}
                          >
                            <UserAvatarImage
                              avatar={filename}
                              className="h-14 w-full"
                              imgClassName="object-contain object-bottom p-0.5"
                            />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Favorite sports</p>
                  <p className="text-xs text-muted-foreground">
                    Optional â€” you can change these later.
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {ONBOARDING_SPORT_OPTIONS.map((sport) => {
                      const selected = favoriteSports.includes(sport.id)
                      return (
                        <button
                          key={sport.id}
                          type="button"
                          onClick={() => toggleSport(sport.id)}
                          aria-pressed={selected}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            selected
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                          )}
                        >
                          <Image
                            src={sport.ballSrc}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 object-contain"
                          />
                          {sport.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </section>
            ) : null}

            {panelStep === 'youre_ready' ? (
              <section className="space-y-4 text-center">
                <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                  You&apos;re Ready
                </h1>
                <p className="text-base text-muted-foreground sm:text-lg">
                  Jump into a pool, start your own, or explore the app â€” your
                  call.
                </p>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col overflow-x-hidden px-4">
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
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {isSliding && leftPanelStep && rightPanelStep ? (
          <div
            className={cn(
              'flex h-full w-[200%] will-change-transform',
              trackTransition &&
                'transition-transform duration-[320ms] ease-in-out',
            )}
            style={{ transform: `translateX(${trackX}%)` }}
            aria-hidden
          >
            <div className="pointer-events-none flex h-full w-1/2 shrink-0 flex-col">
              {renderStepPanel(leftPanelStep)}
            </div>
            <div className="pointer-events-none flex h-full w-1/2 shrink-0 flex-col">
              {renderStepPanel(rightPanelStep)}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 w-full flex-col">
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
              {saving ? 'Finishingâ€¦' : 'Join a pool'}
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
                Savingâ€¦
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
