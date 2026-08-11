'use client'

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Zap } from 'lucide-react'
import confetti from 'canvas-confetti'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { useAuth } from '@/src/lib/auth-context'
import {
  POOL_SCORING_STYLE_OPTIONS,
  type PoolScoringStyleId,
} from '@/src/lib/scoring-style-display'
import { supabase } from '@/src/lib/supabase'
import { capturePostHog, poolCreatedMode } from '@/src/lib/posthog-client'
import { trackEvent } from '@/src/lib/track'
import {
  formatSportingEventDateRange,
  listCreatableSportingEvents,
  type SportingEvent,
} from '@/src/lib/current-event'
import {
  normalizePoolDescription,
  normalizePoolName,
  POOL_DESCRIPTION_MAX_LENGTH,
  POOL_NAME_MAX_LENGTH,
  validatePoolDescription,
  validatePoolName,
} from '@/src/lib/pool-name'
import { normalizeSportKey } from '@/src/lib/sport-display'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

const TOTAL_STEPS = 4

const FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]/50'

type SportId = 'soccer' | 'basketball' | 'baseball' | 'football' | 'hockey'

/** Map create-flow sport tiles → normalizeSportKey buckets on sporting_events.sport. */
const CREATE_SPORT_KEY: Record<SportId, string> = {
  soccer: 'football',
  basketball: 'basketball',
  baseball: 'baseball',
  football: 'american_football',
  hockey: 'hockey',
}

const SPORTS: {
  id: SportId
  label: string
  imageSrc: string
}[] = [
  { id: 'soccer', label: 'Soccer/Fútbol', imageSrc: '/sports/soccer.png' },
  { id: 'basketball', label: 'Basketball', imageSrc: '/sports/basketball.png' },
  { id: 'baseball', label: 'Baseball', imageSrc: '/sports/baseball.png' },
  { id: 'football', label: 'Football', imageSrc: '/sports/football.png' },
  { id: 'hockey', label: 'Hockey', imageSrc: '/sports/hockey.png' },
]

type CreatedPool = {
  id: string
  name: string
  inviteCode: string
}

function fireConfettiBursts() {
  confetti({
    particleCount: 120,
    spread: 72,
    origin: { x: 0.5, y: 0 },
  })
  window.setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 100,
      origin: { x: 0.5, y: 0 },
    })
  }, 250)
}

const SHARE_BUTTON_CLASS = cn(
  'w-full rounded-lg border border-[#1e2d3d] px-2 py-1.5 text-[10px] font-medium text-[#5a7080] transition-colors hover:border-[#1e2d3d] hover:bg-[#080b0f] hover:text-[#f0f4f8] sm:text-xs sm:px-2',
  FOCUS_RING_CLASS,
)

const PRIMARY_CTA_CLASS = cn(
  'w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90',
  FOCUS_RING_CLASS,
)

const INVITE_QR_PROPS = {
  size: 160,
  bgColor: '#ffffff',
  fgColor: '#080b0f',
  level: 'M' as const,
  marginSize: 4,
}

function StepIndicator({ step }: { step: number }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-[#5a7080]">
      Step {step} of {TOTAL_STEPS}
    </p>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-sm text-[#5a7080] transition-colors hover:text-[#00e676]',
        FOCUS_RING_CLASS,
        'rounded-md',
      )}
    >
      ← Back
    </button>
  )
}

function formatSportLabel(sport: SportId | null): string {
  if (!sport) return '—'
  return SPORTS.find((row) => row.id === sport)?.label ?? sport
}

export default function CreatePoolPage() {
  const inviteQrCanvasRef = useRef<HTMLCanvasElement>(null)
  const goToPoolRef = useRef<HTMLAnchorElement>(null)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [step, setStep] = useState(1)
  const [selectedSport, setSelectedSport] = useState<SportId | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [creatableEvents, setCreatableEvents] = useState<SportingEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [poolName, setPoolName] = useState('')
  const [poolDescription, setPoolDescription] = useState('')
  const [scoringStyle, setScoringStyle] = useState<PoolScoringStyleId>('winner')
  const [submitting, setSubmitting] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [createdPool, setCreatedPool] = useState<CreatedPool | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const selectedEvent = useMemo((): SportingEvent | null => {
    if (!selectedEventId) return null
    return creatableEvents.find((event) => event.id === selectedEventId) ?? null
  }, [creatableEvents, selectedEventId])

  const eventsForSelectedSport = useMemo(() => {
    if (!selectedSport) return []
    const sportKey = CREATE_SPORT_KEY[selectedSport]
    return creatableEvents.filter(
      (event) => normalizeSportKey(event.sport) === sportKey,
    )
  }, [creatableEvents, selectedSport])

  const selectedScoring = useMemo(
    () => POOL_SCORING_STYLE_OPTIONS.find((s) => s.id === scoringStyle) ?? null,
    [scoringStyle],
  )

  const loadCreatableEvents = useCallback(async () => {
    setEventsLoading(true)
    setEventsError(null)
    try {
      const rows = await listCreatableSportingEvents(supabase)
      setCreatableEvents(rows)
    } catch (err) {
      console.error('create: failed to load creatable events', err)
      setCreatableEvents([])
      setEventsError('Could not load events. Please try again.')
    } finally {
      setEventsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step !== 2) return
    void loadCreatableEvents()
  }, [step, loadCreatableEvents])

  useEffect(() => {
    if (step !== 4 || !createdPool) return

    let cancelled = false

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          fireConfettiBursts()
          goToPoolRef.current?.focus()
        }
      })
    })

    return () => {
      cancelled = true
    }
  }, [step, createdPool])

  const inviteLink = useMemo(() => {
    if (!createdPool || typeof window === 'undefined') return ''
    return `${window.location.origin}/join/${createdPool.inviteCode}`
  }, [createdPool])

  const shareMessage = useMemo(() => {
    if (!createdPool) return ''
    return `Join my prediction pool "${createdPool.name}" on PoolCup!`
  }, [createdPool])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?next=/create')
    }
  }, [authLoading, user, router])

  function handleSportSelect(sport: SportId) {
    setSelectedSport(sport)
    setSelectedEventId(null)
    setError(null)
    setStep(2)
  }

  function handleEventSelect(eventId: string) {
    setSelectedEventId(eventId)
    setError(null)
    setStep(3)
  }

  async function createPool() {
    if (!user || submitting) return

    const nameValidation = validatePoolName(poolName)
    const descriptionValidation = validatePoolDescription(poolDescription)
    setNameError(nameValidation)
    setDescriptionError(descriptionValidation)
    if (nameValidation || descriptionValidation) {
      setError(null)
      return
    }

    if (!selectedEvent) {
      setError('Select an event before creating your pool.')
      return
    }

    setError(null)
    setSubmitting(true)
    setLoadingMessage('Creating pool…')

    const trimmedName = normalizePoolName(poolName)
    const trimmedDescription = normalizePoolDescription(poolDescription)

    // Bind pool to the selected row's real sporting_events.id (no slug re-lookup).
    const { data: pool, error: insertError } = await supabase
      .from('pools')
      .insert({
        name: trimmedName,
        description: trimmedDescription || null,
        scoring_style: scoringStyle,
        event_name: selectedEvent.name,
        event_id: selectedEvent.id,
        creator_id: user.id,
      })
      .select('id, invite_code')
      .single()

    if (insertError || !pool) {
      setSubmitting(false)
      setLoadingMessage(null)
      setError(insertError?.message ?? 'Failed to create pool')
      return
    }

    setLoadingMessage('Adding you to the pool…')

    const { data: profile } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()

    let displayName = profile?.display_name?.trim()
    if (!displayName) {
      const emailUsername = user.email?.split('@')[0]?.trim()
      displayName = emailUsername || 'Pool creator'
    }

    const { error: memberError } = await supabase.from('pool_members').insert({
      pool_id: pool.id,
      user_id: user.id,
      display_name: displayName,
    })

    if (memberError) {
      setSubmitting(false)
      setLoadingMessage(null)
      setError(memberError.message)
      return
    }

    const { error: pointsError } = await supabase.rpc(
      'award_pool_creation_points',
      { p_pool_id: pool.id },
    )
    if (pointsError) {
      console.error('award_pool_creation_points failed:', pointsError.message)
    }

    setSubmitting(false)
    setLoadingMessage(null)
    setCreatedPool({
      id: pool.id,
      name: trimmedName,
      inviteCode: pool.invite_code,
    })
    capturePostHog('pool_created', {
      mode: poolCreatedMode(scoringStyle),
      pool_id: pool.id,
    })
    setStep(4)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await createPool()
  }

  function copyInviteLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    trackEvent('invite_link_copied', {
      poolId: createdPool?.id,
      userId: user?.id,
      metadata: { source: 'create_success' },
    })
    setLinkCopied(true)
    window.setTimeout(() => setLinkCopied(false), 2000)
  }

  function downloadInviteQr() {
    if (!inviteLink || !createdPool) return

    const canvas = inviteQrCanvasRef.current
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = `poolcup-invite-${createdPool.inviteCode}.png`
    anchor.click()

    trackEvent('invite_link_shared', {
      poolId: createdPool.id,
      userId: user?.id,
      metadata: { channel: 'qr_download' },
    })
  }

  function openShareUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function shareTelegram() {
    trackEvent('invite_link_shared', {
      poolId: createdPool?.id,
      userId: user?.id,
      metadata: { channel: 'telegram' },
    })
    openShareUrl(
      `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareMessage)}`,
    )
  }

  function shareFacebook() {
    trackEvent('invite_link_shared', {
      poolId: createdPool?.id,
      userId: user?.id,
      metadata: { channel: 'facebook' },
    })
    openShareUrl(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`,
    )
  }

  function shareSms() {
    trackEvent('invite_link_shared', {
      poolId: createdPool?.id,
      userId: user?.id,
      metadata: { channel: 'sms' },
    })
    window.location.href = `sms:?&body=${encodeURIComponent(shareMessage)}`
  }

  function shareEmail() {
    trackEvent('invite_link_shared', {
      poolId: createdPool?.id,
      userId: user?.id,
      metadata: { channel: 'email' },
    })
    window.location.href = `mailto:?subject=${encodeURIComponent(`Join ${createdPool?.name ?? 'my pool'} on PoolCup`)}&body=${encodeURIComponent(`${shareMessage}\n\n${inviteLink}`)}`
  }

  async function shareInvite() {
    if (!inviteLink || !createdPool) return

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: createdPool.name,
          text: shareMessage,
          url: inviteLink,
        })
        trackEvent('invite_link_shared', {
          poolId: createdPool.id,
          userId: user?.id,
          metadata: { channel: 'native' },
        })
      } catch (e) {
        if (
          typeof e === 'object' &&
          e !== null &&
          'name' in e &&
          (e as { name: string }).name === 'AbortError'
        ) {
          return
        }
      }
      return
    }

    copyInviteLink()
  }

  if (authLoading || !user) {
    return (
      <main
        className={cn(
          'min-h-screen bg-background flex items-center justify-center',
          MOBILE_BOTTOM_NAV_PAD_CLASS,
        )}
      >
        <p className="text-[#5a7080]">Loading…</p>
      </main>
    )
  }

  const containerWidth =
    step === 1 ? 'max-w-2xl' : step === 2 ? 'max-w-lg' : 'max-w-md'

  return (
    <main
      className={cn(
        'min-h-screen bg-background flex items-center justify-center px-4 py-10',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <div className={`w-full ${containerWidth}`}>
        <div className="rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-8 shadow-xl">
          {step === 1 ? (
            <Link
              href="/dashboard"
              className={cn(
                'text-sm text-[#5a7080] hover:text-[#00e676] transition-colors rounded-md',
                FOCUS_RING_CLASS,
              )}
            >
              ← Back to dashboard
            </Link>
          ) : null}

          <div className={step === 1 ? 'mt-4' : ''}>
            <StepIndicator step={step} />
          </div>

          {step === 1 && (
            <>
              <h1 className="mt-4 font-display text-3xl tracking-wide text-[#f0f4f8]">
                Choose a sport
              </h1>
              <p className="mt-2 text-sm text-[#5a7080]">
                Pick the sport your pool will follow.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => handleSportSelect(sport.id)}
                    className={cn(
                      'relative flex flex-col items-center gap-3 rounded-xl border border-[#1e2d3d] bg-[#080b0f] px-4 py-6 text-center transition-all',
                      'cursor-pointer text-[#f0f4f8] hover:border-[#00e676]/50 hover:bg-[#00e676]/5',
                      FOCUS_RING_CLASS,
                    )}
                  >
                    <Image
                      src={sport.imageSrc}
                      alt={sport.label}
                      width={40}
                      height={40}
                      className="h-10 w-10 object-contain"
                    />
                    <span className="text-sm font-medium">{sport.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mt-2">
                <BackButton onClick={() => setStep(1)} />
              </div>

              <h1 className="mt-4 font-display text-3xl tracking-wide text-[#f0f4f8]">
                Choose an event
              </h1>
              <p className="mt-2 text-sm text-[#5a7080]">
                Select the tournament for your pool.
              </p>

              <div className="mt-8 space-y-3">
                {eventsLoading ? (
                  <div className="rounded-xl border border-[#1e2d3d]/60 bg-[#080b0f]/60 px-4 py-8 text-center">
                    <p className="text-sm text-[#5a7080]">Loading events…</p>
                  </div>
                ) : eventsError ? (
                  <div className="rounded-xl border border-[#1e2d3d]/60 bg-[#080b0f]/60 px-4 py-8 text-center">
                    <p className="text-sm text-red-400">{eventsError}</p>
                    <button
                      type="button"
                      onClick={() => void loadCreatableEvents()}
                      className={cn(
                        'mt-4 rounded-lg border border-[#1e2d3d] px-4 py-2 text-sm text-[#f0f4f8] hover:border-[#00e676]/50',
                        FOCUS_RING_CLASS,
                      )}
                    >
                      Try again
                    </button>
                  </div>
                ) : eventsForSelectedSport.length === 0 ? (
                  <div className="rounded-xl border border-[#1e2d3d]/60 bg-[#080b0f]/60 px-4 py-8 text-center opacity-60">
                    <p className="text-sm text-[#5a7080]">
                      No active {formatSportLabel(selectedSport)} events right
                      now — check back soon.
                    </p>
                  </div>
                ) : (
                  eventsForSelectedSport.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => handleEventSelect(event.id)}
                      className={cn(
                        'w-full rounded-xl border border-[#1e2d3d] bg-[#080b0f] px-4 py-5 text-left transition-all hover:border-[#00e676]/50 hover:bg-[#00e676]/5',
                        FOCUS_RING_CLASS,
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-[#f0f4f8]">{event.name}</p>
                        {event.status === 'live' ? (
                          <span className="shrink-0 rounded-full border border-[#00e676]/40 bg-[#00e676]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#00e676]">
                            Live
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[#5a7080]">
                        {formatSportingEventDateRange(
                          event.start_date,
                          event.end_date,
                        )}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="mt-2">
                <BackButton onClick={() => setStep(2)} />
              </div>

              <h1 className="mt-4 font-display text-3xl tracking-wide text-[#f0f4f8]">
                Create a Pool
              </h1>
              <p className="mt-2 text-sm text-[#5a7080]">
                Set up your pool and start inviting your squad.
              </p>

              <div className="mt-6 rounded-xl border border-[#1e2d3d] bg-[#080b0f]/70 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5a7080]">
                  Creating
                </p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5a7080]">Sport</dt>
                    <dd className="text-right font-medium text-[#f0f4f8]">
                      {formatSportLabel(selectedSport)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5a7080]">Event</dt>
                    <dd className="text-right font-medium text-[#f0f4f8]">
                      {selectedEvent?.name ?? '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5a7080]">Scoring</dt>
                    <dd className="text-right font-medium text-[#f0f4f8]">
                      {selectedScoring?.label ?? scoringStyle}
                    </dd>
                  </div>
                  {normalizePoolName(poolName) ? (
                    <div className="flex justify-between gap-3 border-t border-[#1e2d3d] pt-1.5">
                      <dt className="text-[#5a7080]">Pool name</dt>
                      <dd className="text-right font-medium text-[#00e676]">
                        {normalizePoolName(poolName)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-6">
                <div>
                  <label
                    htmlFor="pool-name"
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#5a7080]"
                  >
                    Pool name
                  </label>
                  <input
                    id="pool-name"
                    type="text"
                    required
                    maxLength={POOL_NAME_MAX_LENGTH}
                    value={poolName}
                    onChange={(e) => {
                      setPoolName(e.target.value)
                      setNameError(null)
                    }}
                    placeholder="Marketing Team WC 2026"
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={
                      nameError ? 'pool-name-error' : 'pool-name-hint'
                    }
                    className={cn(
                      'w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:border-[#00e676] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]/50',
                    )}
                  />
                  <p
                    id="pool-name-hint"
                    className="mt-1.5 text-[11px] text-[#5a7080]"
                  >
                    2–{POOL_NAME_MAX_LENGTH} characters
                  </p>
                  {nameError ? (
                    <p
                      id="pool-name-error"
                      className="mt-1.5 text-sm text-red-400"
                      role="alert"
                    >
                      {nameError}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="pool-description"
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#5a7080]"
                  >
                    Description{' '}
                    <span className="normal-case tracking-normal text-[#5a7080]/80">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="pool-description"
                    rows={3}
                    maxLength={POOL_DESCRIPTION_MAX_LENGTH}
                    value={poolDescription}
                    onChange={(e) => {
                      setPoolDescription(e.target.value)
                      setDescriptionError(null)
                    }}
                    placeholder="Office World Cup pool — winner buys lunch"
                    aria-invalid={Boolean(descriptionError)}
                    aria-describedby={
                      descriptionError
                        ? 'pool-description-error'
                        : 'pool-description-hint'
                    }
                    className={cn(
                      'w-full resize-y rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:border-[#00e676] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]/50',
                    )}
                  />
                  <p
                    id="pool-description-hint"
                    className="mt-1.5 text-[11px] tabular-nums text-[#5a7080]"
                  >
                    {normalizePoolDescription(poolDescription).length}/
                    {POOL_DESCRIPTION_MAX_LENGTH}
                  </p>
                  {descriptionError ? (
                    <p
                      id="pool-description-error"
                      className="mt-1.5 text-sm text-red-400"
                      role="alert"
                    >
                      {descriptionError}
                    </p>
                  ) : null}
                </div>

                <div>
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#5a7080]">
                    Scoring style
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {POOL_SCORING_STYLE_OPTIONS.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setScoringStyle(style.id)}
                        className={cn(
                          'flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                          FOCUS_RING_CLASS,
                          scoringStyle === style.id
                            ? 'border-2 border-[#00e676] bg-[#00e676]/5 text-[#00e676]'
                            : 'border border-[#1e2d3d] text-[#5a7080] hover:text-[#f0f4f8]',
                        )}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                  {selectedScoring ? (
                    <div className="mt-3 rounded-lg border border-[#1e2d3d] bg-[#080b0f]/60 px-4 py-3">
                      <ul className="space-y-1.5 text-sm text-[#5a7080]">
                        {selectedScoring.rules.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs font-medium text-[#00e676]">
                        {selectedScoring.tagline}
                      </p>
                    </div>
                  ) : null}
                </div>

                {error ? (
                  <div
                    className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400"
                    role="alert"
                  >
                    <p>{error}</p>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void createPool()}
                      className={cn(
                        'mt-2 text-sm font-semibold text-[#00e676] underline-offset-4 hover:underline',
                        FOCUS_RING_CLASS,
                        'rounded-md',
                      )}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    'w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50',
                    FOCUS_RING_CLASS,
                  )}
                >
                  {submitting
                    ? (loadingMessage ?? 'Processing…')
                    : 'Create pool'}
                </button>
              </form>
            </>
          )}

          {step === 4 && createdPool && (
            <>
              <h1 className="mt-4 font-display text-3xl tracking-wide text-[#f0f4f8]">
                Pool created!
              </h1>
              <p className="mt-2 text-sm text-[#5a7080]">
                Pools are no fun solo. Invite people to play against you.
              </p>

              <div className="mt-6 flex items-center justify-center gap-2 text-[#00e676]">
                <Zap className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-sm font-semibold">+5 points earned!</span>
              </div>

              <div className="mt-8 flex flex-col items-center">
                <p className="text-xs text-[#5a7080]">Scan to join</p>
                <div className="mt-2 rounded-xl bg-white p-3">
                  <QRCodeSVG value={inviteLink} {...INVITE_QR_PROPS} />
                </div>
                <button
                  type="button"
                  onClick={downloadInviteQr}
                  className={cn(
                    'mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#1e2d3d] px-3 py-1.5 text-xs font-medium text-[#e8eef4] transition-colors hover:border-[#00e676]/50 hover:bg-[#080b0f] hover:text-[#00e676]',
                    FOCUS_RING_CLASS,
                  )}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Download QR
                </button>
                <div className="sr-only" aria-hidden>
                  <QRCodeCanvas
                    ref={inviteQrCanvasRef}
                    value={inviteLink}
                    {...INVITE_QR_PROPS}
                  />
                </div>
              </div>

              <div className="mt-8">
                <label
                  htmlFor="invite-link"
                  className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#5a7080]"
                >
                  Invite link
                </label>
                <input
                  id="invite-link"
                  type="text"
                  readOnly
                  value={inviteLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-sm text-[#f0f4f8] focus:border-[#00e676] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]/50"
                />
              </div>

              <button
                type="button"
                onClick={() => void shareInvite()}
                className={`mt-6 ${PRIMARY_CTA_CLASS}`}
              >
                Share invite
              </button>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                <button
                  type="button"
                  onClick={shareTelegram}
                  className={SHARE_BUTTON_CLASS}
                >
                  Telegram
                </button>
                <button
                  type="button"
                  onClick={shareFacebook}
                  className={SHARE_BUTTON_CLASS}
                >
                  Facebook
                </button>
                <button
                  type="button"
                  onClick={shareSms}
                  className={SHARE_BUTTON_CLASS}
                >
                  SMS
                </button>
                <button
                  type="button"
                  onClick={shareEmail}
                  className={SHARE_BUTTON_CLASS}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className={SHARE_BUTTON_CLASS}
                >
                  {linkCopied ? 'Copied!' : 'Copy link'}
                </button>
              </div>

              <Link
                ref={goToPoolRef}
                href={`/pool/${createdPool.inviteCode}`}
                className={cn(
                  'mt-6 flex w-full items-center justify-center rounded-lg border-2 border-[#00e676] bg-[#00e676]/10 px-4 py-3 text-sm font-semibold text-[#00e676] transition-colors hover:bg-[#00e676]/20',
                  FOCUS_RING_CLASS,
                )}
              >
                Go to my pool
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
