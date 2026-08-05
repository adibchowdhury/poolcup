'use client'

import { useCallback, useState, type ReactNode } from 'react'
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

/** Stable invite code so the success screen doesn’t jitter. */
const DEMO_INVITE_CODE = 'officewc'

function fireConfettiBurst() {
  confetti({
    particleCount: 80,
    spread: 72,
    origin: { x: 0.5, y: 0.6 },
  })
}

function StepDots({
  step,
  completed,
  onStepClick,
}: {
  step: number
  completed: boolean
  onStepClick: (target: number) => void
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
              onClick={() => onStepClick(n)}
              className={cn(
                'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-xs font-semibold transition-colors hover:opacity-90 sm:h-8 sm:w-8',
                isActive || isDone
                  ? 'bg-[#00e676] text-[#080b0f]'
                  : 'border border-[#1e2d3d] text-[#5a7080] hover:border-[#00e676]/50 hover:text-[#f0f4f8]',
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

function PrimaryActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(STEP_PRIMARY_ACTION_CLASS, PRIMARY_BTN_CLASS)}
    >
      {children}
    </button>
  )
}

function Step1NamePool({
  poolName,
  onPoolNameChange,
  onContinue,
}: {
  poolName: string
  onPoolNameChange: (value: string) => void
  onContinue: () => void
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
            htmlFor="demo-pool-name"
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#728d9c]"
          >
            Pool name
          </label>
          <input
            id="demo-pool-name"
            type="text"
            value={poolName}
            onChange={(e) => onPoolNameChange(e.target.value)}
            className={INPUT_CLASS}
            placeholder="e.g. Office World Cup"
          />
        </div>
      </div>
      <PrimaryActionButton
        disabled={!poolName.trim()}
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
}: {
  scoringStyle: DemoScoringStyle
  onSelect: (id: DemoScoringStyle) => void
  onContinue: () => void
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
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-2 border-[#00e676] bg-[#00e676]/5'
                    : 'border border-[#1e2d3d] hover:bg-[#080b0f]/40',
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
      <PrimaryActionButton onClick={onContinue}>Continue</PrimaryActionButton>
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
}: {
  poolName: string
  scoringStyle: DemoScoringStyle
  created: boolean
  inviteLink: string
  linkCopied: boolean
  onCreate: () => void
  onCopy: () => void
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
            />
          </div>

          <button
            type="button"
            onClick={onCopy}
            className={cn(
              'mt-2 w-full rounded-lg border border-[#1e2d3d] px-4 py-2 text-sm font-medium text-[#5a7080] transition-colors',
              'hover:border-[#1e2d3d] hover:bg-[#080b0f] hover:text-[#f0f4f8]',
            )}
          >
            {linkCopied ? 'Copied!' : 'Copy link'}
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
          )}
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
      <PrimaryActionButton onClick={onCreate}>Create pool</PrimaryActionButton>
    </div>
  )
}

type HowItWorksDemoProps = {
  /** Drop outer card chrome when nested in a feature FeatureCardShell. */
  embedded?: boolean
}

export function HowItWorksDemo({ embedded = false }: HowItWorksDemoProps) {
  const [step, setStep] = useState(1)
  const [poolName, setPoolName] = useState('')
  const [scoringStyle, setScoringStyle] =
    useState<DemoScoringStyle>('winner')
  const [created, setCreated] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

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
    setStep(target)
    if (target < 3) {
      setCreated(false)
    }
  }

  const body = (
    <>
      <StepDots step={step} completed={created} onStepClick={goToStep} />

      {step === 1 ? (
        <Step1NamePool
          key="step-1"
          poolName={poolName}
          onPoolNameChange={setPoolName}
          onContinue={() => setStep(2)}
        />
      ) : null}

      {step === 2 ? (
        <Step2ScoringStyle
          key="step-2"
          scoringStyle={scoringStyle}
          onSelect={setScoringStyle}
          onContinue={() => setStep(3)}
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
        />
      ) : null}
    </>
  )

  if (embedded) {
    return <div className="w-full p-5 md:p-6">{body}</div>
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111a27] p-5 md:p-6">
        {body}
      </div>
    </div>
  )
}
