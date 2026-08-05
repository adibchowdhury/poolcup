'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/src/lib/track'

type DemoScoringStyle = 'classic' | 'winner'

const SCORING_OPTIONS: {
  id: DemoScoringStyle
  label: string
  description: string
}[] = [
  {
    id: 'classic',
    label: 'Score Predictor',
    description:
      'Predict the exact final score. Exact score = 5 pts. Correct draw = 3 pts. Correct winner = 2 pts. Wrong = 0 pts.',
  },
  {
    id: 'winner',
    label: 'Winner Only',
    description:
      'Correct draw = 3 pts. Correct winner = 2 pts. Wrong = 0 pts. No exact-score tier.',
  },
]

const INPUT_CLASS =
  'w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-2.5 text-sm text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:outline-none focus:ring-2 focus:ring-[#00e676]/50 focus:border-[#00e676]'

const PRIMARY_BTN_CLASS =
  'w-full rounded-lg bg-[#00e676] px-4 py-2.5 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50'

/** Tallest step: scoring-style (step 2). Fixed at md+ so the card does not resize between steps. */
const STEP_FRAME_CLASS = 'md:flex md:min-h-[22rem] md:flex-col'
const STEP_CONTENT_CLASS = 'md:flex-1'
const STEP_PRIMARY_ACTION_CLASS = 'mt-4 shrink-0 md:mt-auto'

const STEP_TITLE_CLASS =
  'font-display text-2xl tracking-[0.06em] text-[#f0f4f8]'

const STEP_ENTER_CLASS =
  'motion-reduce:animate-none animate-[how-it-works-step-in_0.4s_ease-out]'

/** Demo pool name typed during step-1 autoplay. */
const DEMO_POOL_NAME = 'Office World Cup'

/** Stable invite code so the success screen doesn’t jitter every loop. */
const DEMO_INVITE_CODE = 'officewc'

/** Scoring option the autoplay “picks” on step 2 (shows a clear selection change). */
const DEMO_SCORING_PICK: DemoScoringStyle = 'classic'

/**
 * Autoplay timings. Step 1 pacing is intentionally unchanged.
 *
 * Steps 2–3 target ~6s+ on screen each:
 *   action (~1.5–2.5s, unhurried) → long HOLD on completed state (~3.5–4s+) → advance.
 */
const AUTOPLAY = {
  // —— Step 1 (unchanged) ——
  /** ~6 chars/sec → ~2.5s for "Office World Cup" */
  typeMsPerChar: 155,
  pauseAfterTypeMs: 450,
  step1PressMs: 280,

  // —— Step 2 ——
  // BEFORE totals: 1600+900+1600+420 = 4520ms (~4.5s)
  // AFTER  totals: 900+1200+1000+550 = 3650ms (~3.7s)  [hold was 4000, now −3000]
  /** Brief orient after landing */
  step2EnterPauseMs: 900, // was 1600
  /** Deliberate pre-select highlight (half-speed feel) */
  step2PreSelectMs: 1200, // was 900
  /** HOLD on selected scoring option — main readability beat */
  step2AfterSelectMs: 1000, // was 4000 (−3000ms)
  step2PressMs: 550, // was 420

  // —— Step 3 ——
  // BEFORE totals: 1700+420+1500+1000+3200 = 7820ms (but review→create felt rushed)
  // AFTER  totals: 1800+550+2800+900+3800 = 9850ms (~9.9s)
  /** Read the review summary before Create */
  step3EnterPauseMs: 1800, // was 1700
  step3PressMs: 550, // was 420
  /** HOLD on “Pool created!” + invite link before copy beat */
  step3BeforeCopyMs: 2800, // was 1500
  step3CopyPressMs: 900, // was 1000
  /** HOLD after copy so invite link stays readable */
  step3SuccessHoldMs: 3800, // was 3200

  loopGapMs: 600, // was 500
} as const

type AutoPlayPhase =
  | 'step1-typing'
  | 'step1-pause'
  | 'step1-press'
  | 'step2-enter'
  | 'step2-select'
  | 'step2-pause'
  | 'step2-press'
  | 'step3-enter'
  | 'step3-press'
  | 'step3-success'

function fireConfettiBurst() {
  confetti({
    particleCount: 80,
    spread: 72,
    origin: { x: 0.5, y: 0.6 },
  })
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

function useInViewActive<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(Boolean(entry?.isIntersecting))
      },
      { threshold: 0.35 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, inView]
}

function delay(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), ms)
  }).then(() => {
    if (signal.cancelled) return
  })
}

function StepDots({
  step,
  completed,
  onStepClick,
  interactive,
}: {
  step: number
  completed: boolean
  onStepClick: (target: number) => void
  interactive: boolean
}) {
  return (
    <div className="mb-5 flex items-center justify-center gap-2 sm:gap-3">
      {[1, 2, 3].map((n) => {
        const isActive = n === step
        const isDone = completed ? n <= 3 : n < step
        return (
          <div key={n} className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                if (!interactive) return
                onStepClick(n)
              }}
              disabled={!interactive}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:h-8 sm:w-8',
                interactive
                  ? 'cursor-pointer hover:opacity-90'
                  : 'cursor-default',
                isActive || isDone
                  ? 'bg-[#00e676] text-[#080b0f]'
                  : 'border border-[#1e2d3d] text-[#5a7080]',
                interactive &&
                  !(isActive || isDone) &&
                  'hover:border-[#00e676]/50 hover:text-[#f0f4f8]',
              )}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Go to step ${n}`}
            >
              {n}
            </button>
            {n < 3 && (
              <div
                className={cn(
                  'h-px w-8 sm:w-12',
                  n < step || completed ? 'bg-[#00e676]' : 'bg-[#1e2d3d]',
                )}
                aria-hidden
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function AutoplayPoolNameField({
  value,
  showCaret,
}: {
  value: string
  showCaret: boolean
}) {
  return (
    <div
      className={cn(INPUT_CLASS, 'flex min-h-[42px] items-center')}
      aria-label="Pool name"
      role="text"
    >
      <span className="whitespace-pre">{value}</span>
      {showCaret ? (
        <span
          className="ml-px inline-block h-[1.05em] w-[2px] shrink-0 self-center bg-[#00e676] align-middle animate-[how-it-works-caret_1s_step-end_infinite]"
          aria-hidden
        />
      ) : null}
    </div>
  )
}

function PrimaryActionButton({
  children,
  onClick,
  disabled,
  pressed,
  autoplay,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  pressed?: boolean
  autoplay?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (autoplay) return
        onClick?.()
      }}
      disabled={pressed ? false : disabled}
      className={cn(
        STEP_PRIMARY_ACTION_CLASS,
        PRIMARY_BTN_CLASS,
        'transition-[transform,box-shadow,filter] duration-150',
        pressed &&
          'scale-[0.97] brightness-110 shadow-[0_0_22px_rgba(0,230,118,0.55)]',
        autoplay && 'pointer-events-none',
      )}
      aria-disabled={autoplay || disabled}
    >
      {children}
    </button>
  )
}

function Step1NamePool({
  poolName,
  onPoolNameChange,
  onContinue,
  autoplay,
  continuePressed,
  showCaret,
}: {
  poolName: string
  onPoolNameChange: (value: string) => void
  onContinue: () => void
  autoplay: boolean
  continuePressed: boolean
  showCaret: boolean
}) {
  return (
    <div className={cn(STEP_FRAME_CLASS, STEP_ENTER_CLASS)}>
      <div className={STEP_CONTENT_CLASS}>
        <h3 className={STEP_TITLE_CLASS}>Name your pool</h3>
        <p className="mt-1.5 text-sm text-[#728d9c]">
          Give your pool a name your group will recognize.
        </p>
        <div className="mt-4">
          <label
            htmlFor={autoplay ? undefined : 'demo-pool-name'}
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#728d9c]"
          >
            Pool name
          </label>
          {autoplay ? (
            <AutoplayPoolNameField value={poolName} showCaret={showCaret} />
          ) : (
            <input
              id="demo-pool-name"
              type="text"
              value={poolName}
              onChange={(e) => onPoolNameChange(e.target.value)}
              className={INPUT_CLASS}
            />
          )}
        </div>
      </div>
      <PrimaryActionButton
        autoplay={autoplay}
        pressed={continuePressed}
        disabled={
          autoplay ? poolName !== DEMO_POOL_NAME : !poolName.trim()
        }
        onClick={onContinue}
      >
        Continue
      </PrimaryActionButton>
    </div>
  )
}

function Step2ScoringStyle({
  scoringStyle,
  onSelect,
  onContinue,
  autoplay,
  selectingId,
  continuePressed,
}: {
  scoringStyle: DemoScoringStyle
  onSelect: (id: DemoScoringStyle) => void
  onContinue: () => void
  autoplay: boolean
  selectingId: DemoScoringStyle | null
  continuePressed: boolean
}) {
  return (
    <div className={cn(STEP_FRAME_CLASS, STEP_ENTER_CLASS)}>
      <div className={STEP_CONTENT_CLASS}>
        <h3 className={STEP_TITLE_CLASS}>Choose a scoring style</h3>
        <p className="mt-1.5 text-sm text-[#728d9c]">
          Pick how points are awarded in your pool.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {SCORING_OPTIONS.map((option) => {
            const selected = scoringStyle === option.id
            const selecting = selectingId === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (autoplay) return
                  onSelect(option.id)
                }}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-left transition-all duration-500',
                  selected
                    ? 'border-2 border-[#00e676] bg-[#00e676]/5'
                    : 'border border-[#1e2d3d] hover:border-[#1e2d3d] hover:bg-[#080b0f]/40',
                  selecting &&
                    'scale-[0.985] border-[#00e676]/70 shadow-[0_0_18px_rgba(0,230,118,0.25)]',
                  autoplay && 'pointer-events-none',
                )}
              >
                <span
                  className={cn(
                    'block text-sm font-semibold',
                    selected ? 'text-[#00e676]' : 'text-[#f0f4f8]',
                  )}
                >
                  {option.label}
                </span>
                <span className="mt-1 block text-sm text-[#728d9c]">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <PrimaryActionButton
        autoplay={autoplay}
        pressed={continuePressed}
        onClick={onContinue}
      >
        Continue
      </PrimaryActionButton>
    </div>
  )
}

function Step3CreatePool({
  poolName,
  scoringStyle,
  created,
  inviteLink,
  linkCopied,
  onCreate,
  onCopy,
  autoplay,
  createPressed,
  copyPressed,
}: {
  poolName: string
  scoringStyle: DemoScoringStyle
  created: boolean
  inviteLink: string
  linkCopied: boolean
  onCreate: () => void
  onCopy: () => void
  autoplay: boolean
  createPressed: boolean
  copyPressed: boolean
}) {
  if (created) {
    return (
      <div className={cn(STEP_FRAME_CLASS, 'text-center', STEP_ENTER_CLASS)}>
        <div className={cn(STEP_CONTENT_CLASS, 'text-center')}>
          <h3 className={STEP_TITLE_CLASS}>Pool created!</h3>
          <p className="mt-1.5 text-sm text-[#728d9c]">
            Share this link to invite players to{' '}
            <span className="text-[#f0f4f8]">{poolName.trim()}</span>.
          </p>

          <div className="mt-4 text-left">
            <label
              htmlFor="demo-invite-link"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#728d9c]"
            >
              Invite link
            </label>
            <input
              id="demo-invite-link"
              type="text"
              readOnly
              value={inviteLink}
              onFocus={(e) => e.target.select()}
              className={INPUT_CLASS}
              tabIndex={autoplay ? -1 : 0}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (autoplay) return
              onCopy()
            }}
            className={cn(
              'mt-2 w-full rounded-lg border border-[#1e2d3d] px-4 py-2 text-sm font-medium text-[#5a7080] transition-all duration-150',
              'hover:border-[#1e2d3d] hover:bg-[#080b0f] hover:text-[#f0f4f8]',
              copyPressed &&
                'scale-[0.98] border-[#00e676]/40 bg-[#00e676]/10 text-[#00e676]',
              autoplay && 'pointer-events-none',
            )}
          >
            {linkCopied || copyPressed ? 'Copied!' : 'Copy link'}
          </button>

          <p className="mt-4 text-sm text-[#728d9c]">
            This is a preview. Sign up to create your real pool in 60 seconds.
          </p>
        </div>

        <Link
          href="/login?next=/create"
          onClick={() => trackEvent('demo_cta_clicked')}
          className={cn(
            STEP_PRIMARY_ACTION_CLASS,
            'inline-block',
            PRIMARY_BTN_CLASS,
            autoplay && 'pointer-events-none',
          )}
          tabIndex={autoplay ? -1 : undefined}
        >
          Create your real pool
        </Link>
      </div>
    )
  }

  return (
    <div className={cn(STEP_FRAME_CLASS, STEP_ENTER_CLASS)}>
      <div className={STEP_CONTENT_CLASS}>
        <h3 className={STEP_TITLE_CLASS}>Create your pool</h3>
        <p className="mt-1.5 text-sm text-[#728d9c]">
          Review and create. This is a preview, no account needed.
        </p>
        <dl className="mt-4 space-y-2 rounded-lg border border-[#1e2d3d] bg-[#080b0f]/60 px-4 py-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[#728d9c]">Pool name</dt>
            <dd className="text-right font-medium text-[#f0f4f8]">
              {poolName.trim() || '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#728d9c]">Scoring</dt>
            <dd className="text-right font-medium text-[#f0f4f8]">
              {SCORING_OPTIONS.find((o) => o.id === scoringStyle)?.label}
            </dd>
          </div>
        </dl>
      </div>
      <PrimaryActionButton
        autoplay={autoplay}
        pressed={createPressed}
        onClick={onCreate}
      >
        Create pool
      </PrimaryActionButton>
    </div>
  )
}

export function HowItWorksDemo() {
  const reducedMotion = usePrefersReducedMotion()
  const [rootRef, inView] = useInViewActive<HTMLDivElement>()
  const autoplayActive = inView && !reducedMotion

  const [step, setStep] = useState(1)
  const [poolName, setPoolName] = useState('')
  const [scoringStyle, setScoringStyle] =
    useState<DemoScoringStyle>('winner')
  const [created, setCreated] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [autoPhase, setAutoPhase] = useState<AutoPlayPhase | null>(null)
  const [primaryPressed, setPrimaryPressed] = useState(false)
  const [showCaret, setShowCaret] = useState(false)
  const [selectingId, setSelectingId] = useState<DemoScoringStyle | null>(
    null,
  )
  const [copyPressed, setCopyPressed] = useState(false)

  // Reduced motion: static completed/readable success state.
  useEffect(() => {
    if (!reducedMotion) return
    setPoolName(DEMO_POOL_NAME)
    setScoringStyle(DEMO_SCORING_PICK)
    setStep(3)
    setCreated(true)
    setInviteLink(`https://getpoolcup.com/join/${DEMO_INVITE_CODE}`)
    setPrimaryPressed(false)
    setShowCaret(false)
    setSelectingId(null)
    setCopyPressed(false)
    setAutoPhase(null)
  }, [reducedMotion])

  useEffect(() => {
    if (!autoplayActive) {
      setPrimaryPressed(false)
      setShowCaret(false)
      setSelectingId(null)
      setCopyPressed(false)
      setAutoPhase(null)
      return
    }

    const signal = { cancelled: false }

    async function runLoop() {
      while (!signal.cancelled) {
        // —— STEP 1: type pool name ——
        setStep(1)
        setCreated(false)
        setInviteLink('')
        setLinkCopied(false)
        setScoringStyle('winner')
        setPoolName('')
        setPrimaryPressed(false)
        setSelectingId(null)
        setCopyPressed(false)
        setShowCaret(true)
        setAutoPhase('step1-typing')

        for (let i = 1; i <= DEMO_POOL_NAME.length; i++) {
          if (signal.cancelled) return
          setPoolName(DEMO_POOL_NAME.slice(0, i))
          await delay(AUTOPLAY.typeMsPerChar, signal)
        }

        if (signal.cancelled) return
        setShowCaret(false)
        setAutoPhase('step1-pause')
        await delay(AUTOPLAY.pauseAfterTypeMs, signal)

        if (signal.cancelled) return
        setAutoPhase('step1-press')
        setPrimaryPressed(true)
        await delay(AUTOPLAY.step1PressMs, signal)

        if (signal.cancelled) return
        setPrimaryPressed(false)

        // —— STEP 2: choose scoring style ——
        setStep(2)
        setAutoPhase('step2-enter')
        await delay(AUTOPLAY.step2EnterPauseMs, signal)

        if (signal.cancelled) return
        setAutoPhase('step2-select')
        setSelectingId(DEMO_SCORING_PICK)
        await delay(AUTOPLAY.step2PreSelectMs, signal)

        if (signal.cancelled) return
        setScoringStyle(DEMO_SCORING_PICK)
        setSelectingId(null)
        setAutoPhase('step2-pause')
        await delay(AUTOPLAY.step2AfterSelectMs, signal)

        if (signal.cancelled) return
        setAutoPhase('step2-press')
        setPrimaryPressed(true)
        await delay(AUTOPLAY.step2PressMs, signal)

        if (signal.cancelled) return
        setPrimaryPressed(false)

        // —— STEP 3: review + create ——
        setStep(3)
        setCreated(false)
        setAutoPhase('step3-enter')
        await delay(AUTOPLAY.step3EnterPauseMs, signal)

        if (signal.cancelled) return
        setAutoPhase('step3-press')
        setPrimaryPressed(true)
        await delay(AUTOPLAY.step3PressMs, signal)

        if (signal.cancelled) return
        setPrimaryPressed(false)
        setInviteLink(`https://getpoolcup.com/join/${DEMO_INVITE_CODE}`)
        setCreated(true)
        setAutoPhase('step3-success')
        fireConfettiBurst()

        // Soft “copy link” beat so the success action is clear.
        await delay(AUTOPLAY.step3BeforeCopyMs, signal)
        if (signal.cancelled) return
        setCopyPressed(true)
        setLinkCopied(true)
        await delay(AUTOPLAY.step3CopyPressMs, signal)
        if (signal.cancelled) return
        setCopyPressed(false)

        await delay(AUTOPLAY.step3SuccessHoldMs, signal)
        if (signal.cancelled) return
        await delay(AUTOPLAY.loopGapMs, signal)
      }
    }

    void runLoop()

    return () => {
      signal.cancelled = true
    }
  }, [autoplayActive])

  const handleCreatePool = useCallback(() => {
    setInviteLink(`https://getpoolcup.com/join/${DEMO_INVITE_CODE}`)
    setCreated(true)
    fireConfettiBurst()
    trackEvent('demo_completed', {
      metadata: { scoring_style: scoringStyle },
    })
  }, [scoringStyle])

  function copyInviteLink() {
    if (!inviteLink) return
    void navigator.clipboard.writeText(inviteLink)
    setLinkCopied(true)
    window.setTimeout(() => setLinkCopied(false), 2000)
  }

  function goToStep(target: number) {
    if (autoplayActive) return
    setStep(target)
    if (target < 3) {
      setCreated(false)
    }
  }

  return (
    <div ref={rootRef} className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111a27] p-5 md:p-6">
        <StepDots
          step={step}
          completed={created}
          onStepClick={goToStep}
          interactive={!autoplayActive}
        />

        <span className="sr-only" aria-live="polite">
          {autoPhase ? `Demo ${autoPhase}` : null}
        </span>

        {step === 1 ? (
          <Step1NamePool
            key="step-1"
            poolName={poolName}
            onPoolNameChange={setPoolName}
            onContinue={() => setStep(2)}
            autoplay={autoplayActive}
            continuePressed={primaryPressed}
            showCaret={showCaret}
          />
        ) : null}

        {step === 2 ? (
          <Step2ScoringStyle
            key="step-2"
            scoringStyle={scoringStyle}
            onSelect={setScoringStyle}
            onContinue={() => setStep(3)}
            autoplay={autoplayActive}
            selectingId={selectingId}
            continuePressed={primaryPressed}
          />
        ) : null}

        {step === 3 ? (
          <Step3CreatePool
            key={created ? 'step-3-done' : 'step-3-review'}
            poolName={poolName}
            scoringStyle={scoringStyle}
            created={created}
            inviteLink={inviteLink}
            linkCopied={linkCopied}
            onCreate={handleCreatePool}
            onCopy={copyInviteLink}
            autoplay={autoplayActive}
            createPressed={primaryPressed}
            copyPressed={copyPressed}
          />
        ) : null}
      </div>
    </div>
  )
}
