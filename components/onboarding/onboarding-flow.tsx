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
import { Loader2, Upload } from 'lucide-react'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  DISCOVER_POOLS_HREF,
  FIRST_PREDICTION_HREF,
  ONBOARDING_SPORT_OPTIONS,
  ONBOARDING_STEPS,
  nextStep,
  parseOnboardingState,
  resolveResumeStep,
  stepIndex,
  type OnboardingSportId,
  type OnboardingState,
  type OnboardingStepId,
} from '@/src/lib/onboarding'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
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
  favoriteSports: string[]
  avatar: string | null
  customAvatarUrl: string | null
  onboardingState: OnboardingState
  nextPath: string
}

const USERNAME_DEBOUNCE_MS = 400

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export function OnboardingFlow({ bootstrap }: { bootstrap: OnboardingBootstrap }) {
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStepId>(() =>
    resolveResumeStep(bootstrap.onboardingState),
  )
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

  function reportError(
    message: string,
    retry?: () => Promise<void>,
  ) {
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
    capturePostHog('onboarding_started')
  })

  useEffect(() => {
    onStarted()
  }, [])

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

  const persistState = useCallback(
    async (partial: OnboardingState) => {
      const nextState: OnboardingState = {
        ...bootstrap.onboardingState,
        step,
        favorite_sports: favoriteSports,
        username_draft: username || undefined,
        ...partial,
      }
      const { error: updateError } = await supabase
        .from('users')
        .update({ onboarding_state: nextState })
        .eq('id', bootstrap.userId)
      if (updateError) throw new Error(updateError.message)
      return nextState
    },
    [
      bootstrap.onboardingState,
      bootstrap.userId,
      favoriteSports,
      step,
      username,
    ],
  )

  const completeOnboarding = useCallback(
    async (
      mode: 'completed' | 'skipped',
      redirectTo?: string,
    ): Promise<boolean> => {
      setSaving(true)
      clearErrorBanner()
      const { error: updateError } = await supabase
        .from('users')
        .update({
          onboarding_completed: true,
          onboarding_state: {
            step: 'done',
            favorite_sports: favoriteSports,
            username_draft: username || undefined,
          },
        })
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
      )
      const { awardClientXp } = await import('@/src/lib/xp-client')
      await awardClientXp({ sourceType: 'onboarding_complete' })
      router.replace(redirectTo ?? bootstrap.nextPath)
      return true
    },
    [bootstrap.nextPath, bootstrap.userId, favoriteSports, router, username],
  )

  async function goNext(from: OnboardingStepId) {
    setSaving(true)
    clearErrorBanner()
    try {
      const following = nextStep(from)
      await persistState({ step: following ?? from })
      capturePostHog('onboarding_step_completed', { step: from })
      if (!following) {
        await completeOnboarding('completed')
        return
      }
      setStep(following)
    } catch (err) {
      reportError(
        err instanceof Error ? err.message : 'Could not save progress',
        () => goNext(from),
      )
    } finally {
      setSaving(false)
    }
  }

  function toggleSport(id: OnboardingSportId) {
    setFavoriteSports((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  async function saveFavoriteSportsAndContinue() {
    setSaving(true)
    clearErrorBanner()
    const { error: updateError } = await supabase
      .from('users')
      .update({
        favorite_sports: favoriteSports,
        onboarding_state: {
          step: 'username',
          favorite_sports: favoriteSports,
          username_draft: username || undefined,
        },
      })
      .eq('id', bootstrap.userId)

    setSaving(false)
    if (updateError) {
      reportError(updateError.message, () => saveFavoriteSportsAndContinue())
      return
    }
    capturePostHog('onboarding_step_completed', { step: 'favorite_sports' })
    setStep('username')
  }

  // Debounced username availability
  useEffect(() => {
    if (step !== 'username') return
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

  async function saveUsernameAndContinue() {
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

    setSaving(true)
    clearErrorBanner()

    const { available, error: availError } = await checkUsernameAvailable(
      supabase,
      normalized,
      bootstrap.userId,
    )
    if (availError) {
      setSaving(false)
      reportError(availError, () => saveUsernameAndContinue())
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
        onboarding_state: {
          step: 'avatar',
          favorite_sports: favoriteSports,
          username_draft: normalized,
        },
      })
      .eq('id', bootstrap.userId)

    setSaving(false)
    if (updateError) {
      reportError(updateError.message, () => saveUsernameAndContinue())
      return
    }

    setUsername(normalized)
    capturePostHog('onboarding_step_completed', { step: 'username' })
    setStep('avatar')
  }

  const canSubmitUsername =
    !saving &&
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

    const { error: updateError } = await supabase
      .from('users')
      .update({
        avatar: filename,
        custom_avatar_url: null,
        onboarding_state: {
          step: 'avatar',
          favorite_sports: favoriteSports,
          username_draft: username || undefined,
          avatar_touched: true,
        },
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
    const { error: clearError } = await clearCurrentUserCustomAvatar(
      supabase,
      bootstrap.userId,
    )
    if (clearError) {
      setCustomAvatarUrl(previous)
      reportError(clearError, () => handleRemoveCustomAvatar())
    }
  }

  const progress = ((stepIndex(step) + 1) / ONBOARDING_STEPS.length) * 100

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-3">
        <PoolCupLogo />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => void completeOnboarding('skipped')}
          className="text-muted-foreground"
        >
          Skip
        </Button>
      </div>

      <div
        className="mb-6 h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Step {stepIndex(step) + 1} of {ONBOARDING_STEPS.length}
      </p>

      {error ? (
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

      {step === 'value_prop' ? (
        <section className="space-y-5">
          <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
            Welcome to PoolCup
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Predict scores with friends, create private pools for any group, and
            climb live leaderboards as every match kicks off.
          </p>
          <ul className="space-y-2 text-sm text-foreground/90">
            <li>• Private pools for your office, chat, or Discord</li>
            <li>• Exact-score or winner-only styles</li>
            <li>• Live standings that update with the results</li>
          </ul>
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={saving}
            onClick={() => void goNext('value_prop')}
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
        </section>
      ) : null}

      {step === 'favorite_sports' ? (
        <section className="space-y-5">
          <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
            Favorite sports
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick the sports you care about. You can change these later.
          </p>
          {favoriteSports.length === 0 ? (
            <p className="text-sm text-muted-foreground" role="status">
              No sports selected yet — choose at least one, or continue anyway.
            </p>
          ) : null}
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
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={saving}
            onClick={() => void saveFavoriteSportsAndContinue()}
          >
            {saving ? 'Saving…' : 'Continue'}
          </Button>
        </section>
      ) : null}

      {step === 'username' ? (
        <section className="space-y-5">
          <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
            Choose a username
          </h1>
          <p className="text-sm text-muted-foreground">
            Your public handle on PoolCup. Pools and leaderboards still show your
            display name.
          </p>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (!canSubmitUsername) return
              void saveUsernameAndContinue()
            }}
          >
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
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
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!canSubmitUsername}
            >
              {saving ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </section>
      ) : null}

      {step === 'avatar' ? (
        <section className="space-y-5">
          <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
            Pick an avatar
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload a photo or choose a preset. You can skip and change this later.
          </p>
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
              onChange={(event) => void handleAvatarFileSelected(event)}
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
                {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
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
              Loading presets…
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={saving}
              onClick={() => void goNext('avatar')}
            >
              Skip
            </Button>
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={saving}
              onClick={() => void goNext('avatar')}
            >
              {saving ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'join_discover' ? (
        <section className="space-y-5">
          <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
            Join a pool
          </h1>
          <p className="text-sm text-muted-foreground">
            Discover official pools or join one with an invite code from a friend.
          </p>
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={saving}
            onClick={() => {
              void (async () => {
                capturePostHog('onboarding_step_completed', {
                  step: 'join_discover',
                })
                await completeOnboarding('completed', DISCOVER_POOLS_HREF)
              })()
            }}
          >
            {saving ? 'Finishing…' : 'Discover pools'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={saving}
            onClick={() => void goNext('join_discover')}
          >
            Continue without joining
          </Button>
        </section>
      ) : null}

      {step === 'first_prediction' ? (
        <section className="space-y-5">
          <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
            Make your first prediction
          </h1>
          <p className="text-sm text-muted-foreground">
            Head to upcoming matches and lock in a pick before kickoff.
          </p>
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={saving}
            onClick={() => {
              void (async () => {
                capturePostHog('onboarding_step_completed', {
                  step: 'first_prediction',
                })
                await completeOnboarding('completed', FIRST_PREDICTION_HREF)
              })()
            }}
          >
            {saving ? 'Finishing…' : 'View upcoming matches'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={saving}
            onClick={() => void completeOnboarding('completed')}
          >
            {saving ? 'Finishing…' : 'Finish setup'}
          </Button>
        </section>
      ) : null}
    </main>
  )
}
