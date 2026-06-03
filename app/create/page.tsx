'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'

const TOTAL_STEPS = 4

const scoringStyles = [
  { id: 'classic', label: 'Classic' },
  { id: 'winner', label: 'Winner Only' },
  { id: 'exact', label: 'Exact Score' },
] as const

type ScoringStyleId = (typeof scoringStyles)[number]['id']

type SportId = 'soccer' | 'basketball' | 'baseball' | 'football' | 'hockey'

const SPORTS: {
  id: SportId
  label: string
  imageSrc: string
  available: boolean
}[] = [
  { id: 'soccer', label: 'Soccer', imageSrc: '/sports/soccer.png', available: true },
  {
    id: 'basketball',
    label: 'Basketball',
    imageSrc: '/sports/basketball.png',
    available: false,
  },
  {
    id: 'baseball',
    label: 'Baseball',
    imageSrc: '/sports/baseball.png',
    available: false,
  },
  {
    id: 'football',
    label: 'Football',
    imageSrc: '/sports/football.png',
    available: false,
  },
  { id: 'hockey', label: 'Hockey', imageSrc: '/sports/hockey.png', available: false },
]

const SOCCER_EVENTS = [
  {
    id: 'fifa-wc-2026',
    title: 'FIFA World Cup 2026',
    dates: 'Jun 11 to Jul 19',
  },
] as const

type CreatedPool = {
  name: string
  inviteCode: string
}

const fireConfetti = confetti.create(undefined, { useWorker: false })

function fireConfettiBursts() {
  fireConfetti({
    particleCount: 120,
    spread: 72,
    origin: { y: 0.55 },
  })
  window.setTimeout(() => {
    fireConfetti({
      particleCount: 60,
      spread: 100,
      origin: { y: 0.35 },
    })
  }, 250)
}

const SHARE_BUTTON_CLASS =
  'w-full rounded-lg border border-[#1e2d3d] px-2 py-2 text-xs font-medium text-[#f0f4f8] transition-colors hover:border-[#00e676]/50 hover:text-[#00e676] sm:text-sm sm:px-3'

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
      className="text-sm text-[#5a7080] transition-colors hover:text-[#00e676]"
    >
      ← Back
    </button>
  )
}

export default function CreatePoolPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [step, setStep] = useState(1)
  const [selectedSport, setSelectedSport] = useState<SportId | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [poolName, setPoolName] = useState('')
  const [scoringStyle, setScoringStyle] = useState<ScoringStyleId>('classic')
  const [submitting, setSubmitting] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdPool, setCreatedPool] = useState<CreatedPool | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    if (step !== 4 || !createdPool) return

    let cancelled = false

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          fireConfettiBursts()
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
      router.replace('/login')
    }
  }, [authLoading, user, router])

  function handleSportSelect(sport: SportId, available: boolean) {
    if (!available) return
    setSelectedSport(sport)
    setSelectedEventId(null)
    setStep(2)
  }

  function handleEventSelect(eventId: string) {
    setSelectedEventId(eventId)
    setStep(3)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return

    setError(null)
    setSubmitting(true)
    setLoadingMessage('Creating pool…')

    const { data: pool, error: insertError } = await supabase
      .from('pools')
      .insert({
        name: poolName.trim(),
        scoring_style: scoringStyle,
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

    setSubmitting(false)
    setLoadingMessage(null)
    setCreatedPool({
      name: poolName.trim(),
      inviteCode: pool.invite_code,
    })
    setStep(4)
  }

  function copyInviteLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setLinkCopied(true)
    window.setTimeout(() => setLinkCopied(false), 2000)
  }

  function openShareUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function shareWhatsApp() {
    openShareUrl(
      `https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${inviteLink}`)}`,
    )
  }

  function shareSms() {
    window.location.href = `sms:?body=${encodeURIComponent(`${shareMessage} ${inviteLink}`)}`
  }

  function shareEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Join ${createdPool?.name ?? 'my pool'} on PoolCup`)}&body=${encodeURIComponent(`${shareMessage}\n\n${inviteLink}`)}`
  }

  function shareTwitter() {
    openShareUrl(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(inviteLink)}`,
    )
  }

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <p className="text-[#5a7080]">Loading…</p>
      </main>
    )
  }

  const containerWidth =
    step === 1 ? 'max-w-2xl' : step === 2 ? 'max-w-lg' : 'max-w-md'

  const activeEvents =
    selectedSport === 'soccer' ? SOCCER_EVENTS : []

  return (
    <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4 py-10">
      <div className={`w-full ${containerWidth}`}>
        <div className="rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-8 shadow-xl">
          {step === 1 ? (
            <Link
              href="/dashboard"
              className="text-sm text-[#5a7080] hover:text-[#00e676] transition-colors"
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
                      disabled={!sport.available}
                      onClick={() => handleSportSelect(sport.id, sport.available)}
                      className={`relative flex flex-col items-center gap-3 rounded-xl border px-4 py-6 text-center transition-all ${
                        sport.available
                          ? 'cursor-pointer border-[#1e2d3d] bg-[#080b0f] text-[#f0f4f8] hover:border-[#00e676]/50 hover:bg-[#00e676]/5'
                          : 'cursor-not-allowed border-[#1e2d3d]/60 bg-[#080b0f]/60 text-[#5a7080] opacity-60'
                      }`}
                    >
                      {!sport.available && (
                        <span className="absolute right-2 top-2 rounded-full border border-[#1e2d3d] bg-[#111a27] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5a7080]">
                          Coming soon
                        </span>
                      )}
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
                {activeEvents.length === 0 ? (
                  <div className="rounded-xl border border-[#1e2d3d]/60 bg-[#080b0f]/60 px-4 py-8 text-center opacity-60">
                    <p className="text-sm text-[#5a7080]">
                      No active events right now.
                    </p>
                  </div>
                ) : (
                  activeEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => handleEventSelect(event.id)}
                      className="w-full rounded-xl border border-[#1e2d3d] bg-[#080b0f] px-4 py-5 text-left transition-all hover:border-[#00e676]/50 hover:bg-[#00e676]/5"
                    >
                      <p className="font-medium text-[#f0f4f8]">{event.title}</p>
                      <p className="mt-1 text-sm text-[#5a7080]">{event.dates}</p>
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

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div>
                  <label
                    htmlFor="pool-name"
                    className="block text-xs font-medium uppercase tracking-wider text-[#5a7080] mb-2"
                  >
                    Pool name
                  </label>
                  <input
                    id="pool-name"
                    type="text"
                    required
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    placeholder="Marketing Team WC 2026"
                    className="w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:outline-none focus:ring-2 focus:ring-[#00e676]/50 focus:border-[#00e676]"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium uppercase tracking-wider text-[#5a7080] mb-2">
                    Scoring style
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {scoringStyles.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setScoringStyle(style.id)}
                        className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                          scoringStyle === style.id
                            ? 'border-2 border-[#00e676] bg-[#00e676]/5 text-[#00e676]'
                            : 'border border-[#1e2d3d] text-[#5a7080] hover:text-[#f0f4f8]'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-400" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
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

              <div className="mt-6 flex items-center justify-center gap-2 text-[#00e676]">
                <Zap className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-sm font-semibold">+50 points earned!</span>
              </div>

              <div className="mt-8">
                <label
                  htmlFor="invite-link"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5a7080] mb-2"
                >
                  Invite link
                </label>
                <input
                  id="invite-link"
                  type="text"
                  readOnly
                  value={inviteLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-sm text-[#f0f4f8] focus:outline-none focus:ring-2 focus:ring-[#00e676]/50 focus:border-[#00e676]"
                />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className={SHARE_BUTTON_CLASS}
                >
                  {linkCopied ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={shareWhatsApp}
                  className={SHARE_BUTTON_CLASS}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={shareSms}
                  className={SHARE_BUTTON_CLASS}
                >
                  iMessage
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
                  onClick={shareTwitter}
                  className={SHARE_BUTTON_CLASS}
                >
                  X
                </button>
              </div>

              <Link
                href={`/pool/${createdPool.inviteCode}`}
                className="mt-8 flex w-full items-center justify-center rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90"
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
