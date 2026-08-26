'use client'

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Download, Globe, Handshake, Loader2, Lock, Target, X, Zap } from 'lucide-react'
import confetti from 'canvas-confetti'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/src/lib/auth-context'
import {
  POOL_SCORING_STYLE_OPTIONS,
  type PoolScoringStyleId,
} from '@/src/lib/scoring-style-display'
import { supabase } from '@/src/lib/supabase'
import { capturePostHog } from '@/src/lib/posthog-client'
import { trackEvent } from '@/src/lib/track'
import {
  isPoolCreationLimitError,
  POOL_CREATION_LIMIT_MESSAGE,
} from '@/src/lib/pool-creation-limit'
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
import { normalizeTeamLogoUrl } from '@/src/lib/team-logos'
import { startDraftCustomPoolCheckout } from '@/src/lib/draft-custom-pool-checkout-client'
import {
  clearCreateWizardState,
  clearStagedEmblem,
  dataUrlToFile,
  loadCreateWizardState,
  loadPendingEmblemDataUrl,
  loadStagedEmblemDataUrl,
  persistPendingEmblem,
  persistStagedEmblem,
  saveCreateWizardState,
  type CreateWizardPersistedState,
  type PoolCreationDraftPayload,
} from '@/src/lib/create-wizard-persistence'
import { uploadPoolEmblem } from '@/src/lib/upload-pool-emblem'
import { patchPoolSettings } from '@/src/lib/pool-settings-client'
import {
  DEFAULT_POOL_THEME_COLOR,
  normalizePoolThemeColor,
  POOL_THEME_COLOR_PRESETS,
} from '@/src/lib/pool-theme'
import {
  beginCreatePoolExit,
  clearCreateModeDashboardExitClass,
  consumeCreatePoolTransition,
  CREATE_POOL_TRANSITION_KEY,
  readPrefersReducedMotion,
} from '@/src/lib/create-pool-transition'
import { CreateCompetitionStep } from '@/components/create/create-competition-step'
import { DiscordMarkIcon } from '@/components/discord-mark-icon'
import { cn } from '@/lib/utils'
import {
  formatOfficialLeagueName,
  formatOfficialSeasonLabel,
} from '@/src/lib/fetch-official-pools'
import { DISCORD_INVITE_URL } from '@/src/lib/discord-invite'
import type { CreatePoolModalHandoff } from '@/src/lib/create-pool-modal-handoff'

export type CreatePoolWizardProps = {
  /** `page` = mobile full-screen /create; `modal` = desktop hub overlay card. */
  variant: 'page' | 'modal'
  /** Modal × / close — required for variant="modal". */
  onRequestClose?: () => void
  /**
   * Desktop bounce handoff (Stripe return params). When set, used instead of
   * URL searchParams for checkout bootstrap.
   */
  checkoutHandoff?: CreatePoolModalHandoff | null
}

/**
 * `label` = stepper waypoint (short). `chromeTitle` = instruction heading
 * (modal + mobile full-screen chrome — same copy both platforms).
 */
const CREATE_POOL_STEPS = [
  {
    id: 'competition' as const,
    label: 'Competition',
    stepperLabel: 'Competition',
    chromeTitle: 'Choose a competition',
  },
  {
    id: 'type' as const,
    label: 'Pool Type',
    stepperLabel: 'Pool Type',
    chromeTitle: 'How do you want to play?',
  },
  {
    id: 'details' as const,
    label: 'Pool Details',
    stepperLabel: 'Details',
    chromeTitle: 'Set up your pool',
  },
  {
    id: 'plan' as const,
    label: 'Choose Your Pool',
    stepperLabel: 'Plan',
    chromeTitle: 'Choose your pool plan',
  },
  {
    id: 'review' as const,
    label: 'Review & Create',
    stepperLabel: 'Review',
    chromeTitle: 'Review and create your pool',
  },
] as const

const SUCCESS_CHROME_TITLE = 'Pool Created 🎉'

/** Progress indicator: five wizard steps only (success is a terminal page). */
const STEPPER_STEP_COUNT = CREATE_POOL_STEPS.length
const PLAN_STEP = 4
const REVIEW_STEP = 5
/** Terminal success page index — not part of the progress indicator. */
const SUCCESS_STEP = 6
const TOTAL_FLOW_STEPS = SUCCESS_STEP

function chromeTitleForStep(step: number): string {
  if (step >= SUCCESS_STEP) return SUCCESS_CHROME_TITLE
  const index = Math.min(Math.max(step, 1), STEPPER_STEP_COUNT) - 1
  return CREATE_POOL_STEPS[index]?.chromeTitle ?? 'Create a Pool'
}

/** Step carousel slide+fade duration (ms). Single source for CSS and the JS timer. */
const STEP_TRANSITION_MS = 650

function createPoolSlideMotionStyle(
  property: 'transform' | 'opacity',
  enabled: boolean,
): CSSProperties {
  if (!enabled) return {}
  return {
    transitionProperty: property,
    transitionDuration: `${STEP_TRANSITION_MS}ms`,
    transitionTimingFunction: 'ease-in-out',
  }
}

function createPoolNextStep(current: number): number | null {
  return current < TOTAL_FLOW_STEPS ? current + 1 : null
}

const STEPPER_GREEN = '#00e676'

const STEPPER_MOTION_CLASS =
  'transition-all duration-[225ms] ease-out motion-reduce:transition-none motion-reduce:duration-0'

/**
 * Mobile page: full viewport.
 * Desktop modal: uniform viewport-derived frame across all steps.
 * Height: min(760px, 90vh, 100dvh − overlay padding) — soft content cap + short-viewport fit.
 */
const CREATE_POOL_CARD_PAGE_CLASS = cn(
  'flex min-h-0 flex-col bg-transparent px-4 pt-4',
  'pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
  'h-dvh',
)
/** Shared modal frame — 760px soft cap (~40px above the old 720 for footer chrome). */
const CREATE_POOL_MODAL_HEIGHT_CLASS =
  'h-[min(760px,90vh,calc(100dvh-3rem))]'
const CREATE_POOL_CARD_MODAL_CLASS = cn(
  'relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#292929] bg-[#111111] p-8 shadow-2xl',
  CREATE_POOL_MODAL_HEIGHT_CLASS,
  'create-pool-modal-enter',
)

const FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'

/** Step section titles — same 2xl on mobile; former 3xl headings stay 3xl from lg up. */
const CREATE_POOL_STEP_HEADING_CLASS =
  'font-display text-2xl tracking-wide text-[#f0f4f8]'

/** Pinned CTA row. Desktop page keeps a tall slot; modal hugs the buttons. */
const CREATE_POOL_FOOTER_CLASS =
  'flex shrink-0 flex-col justify-end pt-4 max-lg:min-h-0'
const CREATE_POOL_FOOTER_DESKTOP_SLOT_CLASS = 'lg:min-h-[8.75rem]'

/** Secondary / Back — uses design-system outline (neutral), not primary green. */
const CREATE_POOL_BTN_BACK_CLASS = cn(
  'w-full min-w-0 shrink-0 font-semibold lg:w-[38%]',
  '[-webkit-tap-highlight-color:transparent] touch-manipulation select-none',
)

const CREATE_POOL_BTN_PRIMARY_CLASS = cn(
  'ui-tactile-btn ui-tactile-btn--primary w-full font-semibold text-primary-foreground',
  '[-webkit-tap-highlight-color:transparent] touch-manipulation select-none',
  'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_68%,white),var(--primary))]',
  'hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_68%,white),var(--primary))]',
  'active:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_68%,white),var(--primary))]',
  'disabled:pointer-events-none disabled:opacity-50',
)

const CREATE_POOL_SELECTION_TILE_CLASS = cn(
  'transition-all',
  FOCUS_RING_CLASS,
)

function CreatePoolNavFooter({
  showBack,
  onBack,
  continueLabel,
  continueDisabled,
  onContinue,
  continueType = 'button',
  continueForm,
  backDisabled = false,
}: {
  showBack: boolean
  onBack?: () => void
  continueLabel: string
  continueDisabled: boolean
  onContinue?: () => void
  continueType?: 'button' | 'submit'
  continueForm?: string
  backDisabled?: boolean
}) {
  return (
    <div
      className={cn(
        'flex w-full items-stretch pb-1.5 pr-1.5 [-webkit-tap-highlight-color:transparent]',
        showBack
          ? 'max-lg:flex-col max-lg:gap-2.5 lg:flex-row lg:gap-3'
          : 'justify-center gap-3',
      )}
    >
      {showBack ? (
        <Button
          type="button"
          size="lg"
          variant="outline"
          className={CREATE_POOL_BTN_BACK_CLASS}
          disabled={backDisabled}
          onClick={onBack}
        >
          Back
        </Button>
      ) : null}
      <div
        className={cn(
          showBack
            ? 'min-w-0 w-full lg:flex-1'
            : 'w-full max-lg:w-full lg:w-auto',
        )}
      >
        <Button
          type={continueType}
          size="lg"
          form={continueForm}
          className={cn(
            CREATE_POOL_BTN_PRIMARY_CLASS,
            !showBack && 'lg:w-auto lg:min-w-[16rem]',
          )}
          disabled={continueDisabled}
          onClick={continueType === 'button' ? onContinue : undefined}
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  )
}

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
  'w-full rounded-lg border border-[#1e2d3d] px-2 py-1.5 text-[10px] font-medium text-[#5a7080] transition-colors hover:border-[#1e2d3d] hover:bg-[var(--dashboard-card-bg)] hover:text-[#f0f4f8] sm:text-xs sm:px-2',
  FOCUS_RING_CLASS,
)

const PRIMARY_CTA_CLASS = cn(
  'w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90',
  FOCUS_RING_CLASS,
)

const INVITE_QR_PROPS = {
  size: 160,
  bgColor: '#ffffff',
  fgColor: '#080b0f',
  level: 'M' as const,
  marginSize: 4,
}

function usePrefersReducedMotion() {
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

/** Current-step ring (44px) — longest radius used so connectors butt every circle. */
const STEPPER_CIRCLE_TRACK_PX = 44
/** Non-current circle diameter (36px). */
const STEPPER_CIRCLE_DEFAULT_PX = 36

function CreatePoolStepCircle({
  stepNumber,
  status,
  animate,
}: {
  stepNumber: number
  status: 'completed' | 'current' | 'upcoming'
  animate: boolean
}) {
  const isCompleted = status === 'completed'
  const isCurrent = status === 'current'
  const motion = animate ? STEPPER_MOTION_CLASS : ''

  if (isCurrent) {
    return (
      <div
        className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-[#111111]"
        style={{ borderColor: STEPPER_GREEN }}
        aria-current="step"
      >
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums text-white',
            motion,
          )}
          style={{ backgroundColor: STEPPER_GREEN }}
        >
          {stepNumber}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2',
        motion,
        isCompleted ? 'bg-[#00e676]' : 'bg-[#111111]',
      )}
      style={{
        borderColor: STEPPER_GREEN,
        backgroundColor: isCompleted ? STEPPER_GREEN : '#111111',
      }}
    >
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums',
          motion,
          isCompleted
            ? 'pointer-events-none scale-75 opacity-0'
            : 'scale-100 opacity-100',
        )}
        style={{ color: STEPPER_GREEN }}
        aria-hidden={isCompleted}
      >
        {stepNumber}
      </span>
      <Check
        className={cn(
          'absolute h-[1.125rem] w-[1.125rem] stroke-[2.5] text-white',
          motion,
          isCompleted
            ? 'scale-100 opacity-100'
            : 'pointer-events-none scale-75 opacity-0',
        )}
        aria-hidden={!isCompleted}
      />
    </div>
  )
}

/**
 * Progress stepper: equal-width columns.
 * Circle track is a fixed-height row; half-line connectors are absolutely
 * placed at that row's vertical center (labels hang below and never shift lines).
 * Lines butt the circle edge via `calc(50% ± radius)`.
 */
function CreatePoolStepper({
  currentStep,
  labelMode = 'none',
}: {
  currentStep: number
  /** `all` = every label (modal + mobile); `active-only` = current step only. */
  labelMode?: 'none' | 'all' | 'active-only'
}) {
  const reducedMotion = usePrefersReducedMotion()
  const totalSteps = STEPPER_STEP_COUNT
  const animate = !reducedMotion
  const displayStep = Math.min(Math.max(currentStep, 1), totalSteps)
  const showLabels = labelMode !== 'none'

  return (
    <nav
      className="flex w-full justify-center px-1"
      aria-label="Pool creation progress"
    >
      <ol
        className="m-0 flex w-[88%] min-w-0 max-w-full list-none gap-0 p-0"
        role="progressbar"
        aria-valuenow={displayStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Step ${displayStep} of ${totalSteps}`}
      >
        {CREATE_POOL_STEPS.map((poolStep, index) => {
          const stepNumber = index + 1
          const status =
            displayStep > stepNumber
              ? 'completed'
              : displayStep === stepNumber
                ? 'current'
                : 'upcoming'
          const labelVisible =
            showLabels &&
            (labelMode === 'all' ||
              (labelMode === 'active-only' && status === 'current'))
          const radiusPx =
            status === 'current'
              ? STEPPER_CIRCLE_TRACK_PX / 2
              : STEPPER_CIRCLE_DEFAULT_PX / 2

          return (
            <li
              key={poolStep.id}
              className="flex min-w-0 flex-1 flex-col items-center"
              aria-label={`Step ${stepNumber}: ${poolStep.stepperLabel}`}
            >
              {/* Circle track — connectors live only in this row */}
              <div
                className="relative flex w-full items-center justify-center"
                style={{ height: STEPPER_CIRCLE_TRACK_PX }}
              >
                {index > 0 ? (
                  <span
                    className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-[#00e676]"
                    style={{ right: `calc(50% + ${radiusPx}px)` }}
                    aria-hidden
                  />
                ) : null}
                {index < totalSteps - 1 ? (
                  <span
                    className="absolute top-1/2 right-0 h-0.5 -translate-y-1/2 bg-[#00e676]"
                    style={{ left: `calc(50% + ${radiusPx}px)` }}
                    aria-hidden
                  />
                ) : null}
                <CreatePoolStepCircle
                  stepNumber={stepNumber}
                  status={status}
                  animate={animate}
                />
              </div>

              {labelVisible ? (
                <span
                  className={cn(
                    'mt-1.5 max-w-full truncate px-0.5 text-center text-[10px] font-medium leading-tight tracking-wide sm:text-[11px]',
                    status === 'current'
                      ? 'font-semibold text-primary'
                      : status === 'completed'
                        ? 'text-[#5a7080]'
                        : 'text-[#5a7080]/80',
                  )}
                >
                  {poolStep.stepperLabel}
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function formatSportLabel(sport: SportId | null): string {
  if (!sport) return '—'
  return SPORTS.find((row) => row.id === sport)?.label ?? sport
}

function selectionTileClass(selected: boolean) {
  return cn(
    CREATE_POOL_SELECTION_TILE_CLASS,
    // Transparent default, chip hover; selection = green border only.
    'border bg-transparent text-[#5a7080] transition-[background-color,color,border-color,box-shadow] duration-160',
    selected
      ? 'border-primary'
      : 'border-[#1e2d3d] hover:bg-white/[0.03] hover:text-[#f0f4f8]',
  )
}

/** Line-drawn scoreboard motif for Score Predictor cards (~48px). */
function ScorePredictorModeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="5"
        y="10"
        width="38"
        height="28"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M24 10v28" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 20h6M15 20v12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30 20h6v6h-6v6h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Line-drawn trophy motif for Winner Only cards (~48px). */
function WinnerOnlyModeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M16 12h16v8a8 8 0 0 1-16 0v-8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 14H11a3 3 0 0 0 3 7h2M32 14h5a3 3 0 0 1-3 7h-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 28v4M18 38h12M20 34h8v4h-8v-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 18.5 23.2 20.7 27.5 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatCreateFlowCompetitionDisplay(event: SportingEvent): {
  leagueName: string
  seasonLabel: string | null
} {
  return {
    leagueName: formatOfficialLeagueName(event.name, event.name),
    seasonLabel: formatOfficialSeasonLabel(
      event.provider_season,
      event.start_date,
      event.end_date,
    ),
  }
}

export function CreatePoolWizard({
  variant,
  onRequestClose,
  checkoutHandoff = null,
}: CreatePoolWizardProps) {
  const isModal = variant === 'modal';

  const inviteQrCanvasRef = useRef<HTMLCanvasElement>(null)
  const goToPoolRef = useRef<HTMLAnchorElement>(null)
  const emblemInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const emblemInputId = useId()

  const [step, setStep] = useState(1)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [isSliding, setIsSliding] = useState(false)
  const [trackX, setTrackX] = useState(0)
  const [trackTransition, setTrackTransition] = useState(false)
  const [leftPanelStep, setLeftPanelStep] = useState(1)
  const [rightPanelStep, setRightPanelStep] = useState<number | null>(2)
  const [leftOpacity, setLeftOpacity] = useState(1)
  const [rightOpacity, setRightOpacity] = useState(0)
  const slideTimersRef = useRef<number[]>([])
  /** Stable slide viewport while both panes are mounted (desktop card is height:auto). */
  const slideViewportRef = useRef<HTMLDivElement>(null)
  const [slideLockPx, setSlideLockPx] = useState<number | null>(null)
  const [selectedSport, setSelectedSport] = useState<SportId | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [creatableEvents, setCreatableEvents] = useState<SportingEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const defaultSportAppliedRef = useRef(false)
  const [poolName, setPoolName] = useState('')
  const [poolDescription, setPoolDescription] = useState('')
  const [scoringStyle, setScoringStyle] = useState<PoolScoringStyleId>('classic')
  const [isPublic, setIsPublic] = useState(false)
  const [poolNameFocused, setPoolNameFocused] = useState(false)
  const [poolDescriptionFocused, setPoolDescriptionFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [createdPool, setCreatedPool] = useState<CreatedPool | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'custom'>('basic')
  const [themeColor, setThemeColor] = useState<string | null>(null)
  const [emblemFile, setEmblemFile] = useState<File | null>(null)
  const [emblemPreviewUrl, setEmblemPreviewUrl] = useState<string | null>(null)
  const [checkoutPhase, setCheckoutPhase] = useState<
    'idle' | 'finalizing' | 'slow'
  >('idle')
  const [finalizingDraftId, setFinalizingDraftId] = useState<string | null>(
    null,
  )
  const [finalizingMessage, setFinalizingMessage] = useState(
    'Payment received — setting up your pool',
  )
  const checkoutHandledRef = useRef(false)
  const goToStepRef = useRef<(next: number, dir: 1 | -1) => void>(() => {})
  const [screenMotionClass, setScreenMotionClass] = useState<string | null>(
    () => {
      if (typeof window === 'undefined') return null
      if (readPrefersReducedMotion()) return null
      try {
        if (sessionStorage.getItem(CREATE_POOL_TRANSITION_KEY) === 'enter') {
          return 'create-mode-screen-enter'
        }
      } catch {
        return null
      }
      return null
    },
  )
  const [headingStagger, setHeadingStagger] = useState(() => {
    if (typeof window === 'undefined') return false
    if (readPrefersReducedMotion()) return false
    try {
      return sessionStorage.getItem(CREATE_POOL_TRANSITION_KEY) === 'enter'
    } catch {
      return false
    }
  })

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

  /** Prefer sport with the most live events so the right column is populated. */
  useEffect(() => {
    if (defaultSportAppliedRef.current) return
    if (selectedSport != null) {
      defaultSportAppliedRef.current = true
      return
    }
    if (eventsLoading) return

    defaultSportAppliedRef.current = true

    let bestSport: SportId = SPORTS[0]!.id
    let bestLive = -1
    let bestTotal = -1
    for (const sport of SPORTS) {
      const sportKey = CREATE_SPORT_KEY[sport.id]
      const events = creatableEvents.filter(
        (event) => normalizeSportKey(event.sport) === sportKey,
      )
      const liveCount = events.filter((event) => event.status === 'live').length
      if (
        liveCount > bestLive ||
        (liveCount === bestLive && events.length > bestTotal)
      ) {
        bestLive = liveCount
        bestTotal = events.length
        bestSport = sport.id
      }
    }
    setSelectedSport(bestSport)
  }, [creatableEvents, eventsLoading, selectedSport])


  const selectedScoring = useMemo(
    () => POOL_SCORING_STYLE_OPTIONS.find((s) => s.id === scoringStyle) ?? null,
    [scoringStyle],
  )

  const creatableEventsRef = useRef<SportingEvent[]>([])
  creatableEventsRef.current = creatableEvents

  const loadCreatableEvents = useCallback(async () => {
    // Soft refresh when rows already exist — never blank the grid on back-nav.
    const showLoadingFrame = creatableEventsRef.current.length === 0
    if (showLoadingFrame) setEventsLoading(true)
    setEventsError(null)
    try {
      const rows = await listCreatableSportingEvents(supabase)
      setCreatableEvents(rows)
      // Warm CDN logos so remounted tiles paint from memory cache.
      if (typeof window !== 'undefined') {
        for (const row of rows) {
          const url = normalizeTeamLogoUrl(row.logo_url)
          if (!url) continue
          const img = new window.Image()
          img.decoding = 'async'
          img.src = url
        }
      }
    } catch (err) {
      console.error('create: failed to load creatable events', err)
      if (creatableEventsRef.current.length === 0) {
        setCreatableEvents([])
      }
      setEventsError('Could not load events. Please try again.')
    } finally {
      setEventsLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const id of slideTimersRef.current) window.clearTimeout(id)
      slideTimersRef.current = []
    }
  }, [])

  const goToStep = useCallback(
    (next: number, dir: 1 | -1) => {
      if (next === step || isSliding || next < 1 || next > TOTAL_FLOW_STEPS) return

      if (prefersReducedMotion) {
        setSlideLockPx(null)
        setStep(next)
        setLeftPanelStep(next)
        setRightPanelStep(createPoolNextStep(next))
        setTrackX(0)
        setLeftOpacity(1)
        setRightOpacity(0)
        setTrackTransition(false)
        return
      }

      const startX = dir === 1 ? 0 : -50
      const endX = dir === 1 ? -50 : 0
      // Forward: cross-fade. Back: both panes stay opaque — remounted step-1
      // content slides in fully painted (events already in memory).
      const startLeft = 1
      const startRight = dir === 1 ? 0 : 1
      const endLeft = dir === 1 ? 0 : 1
      const endRight = 1

      // Freeze outgoing viewport height before mounting the incoming pane so
      // page variant (lg:h-auto) cannot reflow the track mid translate+fade.
      // Modal uses a fixed card height — lock is unnecessary there.
      const lockPx =
        variant === 'modal'
          ? 0
          : (slideViewportRef.current?.getBoundingClientRect().height ?? 0)

      flushSync(() => {
        if (lockPx > 0) setSlideLockPx(lockPx)
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
        setRightPanelStep(createPoolNextStep(next))
        setTrackX(0)
        setLeftOpacity(1)
        setRightOpacity(0)
        setIsSliding(false)
        setSlideLockPx(null)
        cancelAnimationFrame(rafEnable)
        cancelAnimationFrame(rafEnd)
      }, STEP_TRANSITION_MS)
      slideTimersRef.current.push(doneTimer)
    },
    [isSliding, prefersReducedMotion, step, variant],
  )

  goToStepRef.current = goToStep

  const applyWizardState = useCallback((saved: CreateWizardPersistedState) => {
    const nextStep =
      saved.step >= 1 && saved.step <= REVIEW_STEP ? saved.step : REVIEW_STEP
    setStep(nextStep)
    setLeftPanelStep(nextStep)
    setRightPanelStep(createPoolNextStep(nextStep))
    const sport = saved.selectedSport
    setSelectedSport(
      sport === 'soccer' ||
        sport === 'basketball' ||
        sport === 'baseball' ||
        sport === 'football' ||
        sport === 'hockey'
        ? sport
        : null,
    )
    setSelectedEventId(saved.selectedEventId)
    setPoolName(saved.poolName)
    setPoolDescription(saved.poolDescription)
    setScoringStyle(saved.scoringStyle === 'winner' ? 'winner' : 'classic')
    setIsPublic(Boolean(saved.isPublic))
    setSelectedPlan(saved.selectedPlan === 'custom' ? 'custom' : 'basic')
    setThemeColor(
      saved.themeColor ? normalizePoolThemeColor(saved.themeColor) : null,
    )
    if (saved.hasPendingEmblem) {
      const dataUrl = loadPendingEmblemDataUrl()
      if (dataUrl) {
        const file = dataUrlToFile(dataUrl, 'pool-emblem.jpg')
        if (file) {
          setEmblemFile(file)
          setEmblemPreviewUrl(dataUrl)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (checkoutHandledRef.current) return
    const checkout =
      checkoutHandoff?.checkout ??
      (searchParams.get('checkout') as 'success' | 'cancel' | null)
    if (!checkout) return
    checkoutHandledRef.current = true

    const clearCheckoutUrl = () => {
      if (isModal) return
      router.replace('/create', { scroll: false })
    }

    if (checkout === 'cancel') {
      const saved = loadCreateWizardState()
      if (saved) applyWizardState({ ...saved, step: REVIEW_STEP })
      else {
        setStep(REVIEW_STEP)
        setLeftPanelStep(REVIEW_STEP)
        setRightPanelStep(createPoolNextStep(REVIEW_STEP))
      }
      clearCheckoutUrl()
      return
    }

    if (checkout === 'success') {
      const draftId =
        checkoutHandoff?.draftId?.trim() ||
        searchParams.get('draft_id')?.trim()
      if (!draftId) {
        setError('Missing checkout draft. Check your pools shortly.')
        clearCheckoutUrl()
        return
      }
      setFinalizingDraftId(draftId)
      setCheckoutPhase('finalizing')
      setFinalizingMessage('Payment received — setting up your pool')
      setStep(SUCCESS_STEP)
      setLeftPanelStep(SUCCESS_STEP)
      setRightPanelStep(null)
    }
  }, [applyWizardState, checkoutHandoff, isModal, router, searchParams])

  useEffect(() => {
    if (checkoutPhase === 'idle' || !finalizingDraftId || !user) return

    let cancelled = false
    const startedAt = Date.now()
    const hardTimeoutMs = 15_000
    let attempt = 0
    let timer: number | null = null

    async function finishReady(payload: {
      createdPoolId: string
      inviteCode: string | null
      name: string | null
    }) {
      const poolId = payload.createdPoolId
      const inviteCode = payload.inviteCode?.trim() || ''
      const name = payload.name?.trim() || 'Your pool'

      setFinalizingMessage('Finishing branding…')

      const staged = loadStagedEmblemDataUrl(finalizingDraftId!)
      if (staged) {
        const file = dataUrlToFile(staged, 'pool-emblem.jpg')
        if (file) {
          const upload = await uploadPoolEmblem(supabase, poolId, file)
          if (upload.publicUrl) {
            await patchPoolSettings(poolId, { emblemUrl: upload.publicUrl })
          } else {
            console.warn('create: staged emblem upload failed', upload.error)
          }
        }
      }

      clearStagedEmblem(finalizingDraftId!)
      clearCreateWizardState()

      if (!inviteCode) {
        setCheckoutPhase('slow')
        setFinalizingMessage(
          "Taking longer than expected — we'll finish it. Check your pools shortly.",
        )
        return
      }

      setCreatedPool({ id: poolId, name, inviteCode })
      capturePostHog('pool_created', {
        pool_id: poolId,
        plan: 'custom',
        source: 'draft_checkout',
      })
      setCheckoutPhase('idle')
      setFinalizingDraftId(null)
      setSubmitting(false)
      setLoadingMessage(null)
      goToStepRef.current(SUCCESS_STEP, 1)
    }

    async function pollOnce() {
      if (cancelled) return
      attempt += 1
      try {
        const res = await fetch(
          `/api/pool-drafts/${encodeURIComponent(finalizingDraftId!)}/status`,
        )
        const data = (await res.json().catch(() => null)) as {
          status?: string
          createdPoolId?: string | null
          inviteCode?: string | null
          name?: string | null
        } | null
        if (res.ok && data?.status === 'ready' && data.createdPoolId) {
          await finishReady({
            createdPoolId: data.createdPoolId,
            inviteCode: data.inviteCode ?? null,
            name: data.name ?? null,
          })
          return
        }
      } catch (err) {
        console.warn('create: draft status poll failed', err)
      }

      const elapsed = Date.now() - startedAt
      if (elapsed >= hardTimeoutMs) {
        setCheckoutPhase('slow')
        setFinalizingMessage(
          "Taking longer than expected — we'll finish it. Check your pools shortly.",
        )
      }

      const delay =
        elapsed >= hardTimeoutMs
          ? 4000
          : Math.min(500 + attempt * 500, 2500)
      timer = window.setTimeout(() => {
        void pollOnce()
      }, delay)
    }

    void pollOnce()
    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [checkoutPhase, finalizingDraftId, user])

  useEffect(() => {
    if (checkoutPhase !== 'idle') return
    if (step >= SUCCESS_STEP) return
    saveCreateWizardState({
      step,
      selectedSport,
      selectedEventId,
      poolName,
      poolDescription,
      scoringStyle,
      isPublic,
      selectedPlan,
      themeColor,
      hasPendingEmblem: Boolean(emblemFile),
    })
  }, [
    checkoutPhase,
    step,
    selectedSport,
    selectedEventId,
    poolName,
    poolDescription,
    scoringStyle,
    isPublic,
    selectedPlan,
    themeColor,
    emblemFile,
  ])

  useEffect(() => {
    clearCreateModeDashboardExitClass()
    const kind = consumeCreatePoolTransition()
    if (prefersReducedMotion || readPrefersReducedMotion()) {
      setScreenMotionClass(null)
      setHeadingStagger(false)
      return
    }
    if (kind !== 'enter' && screenMotionClass !== 'create-mode-screen-enter') {
      return
    }
    // Keep enter/stagger classes from the sync initializer; clear after they finish.
    setScreenMotionClass('create-mode-screen-enter')
    setHeadingStagger(true)
    const clearScreen = window.setTimeout(() => {
      setScreenMotionClass(null)
    }, 220)
    const clearHeading = window.setTimeout(() => {
      setHeadingStagger(false)
    }, 360)
    return () => {
      window.clearTimeout(clearScreen)
      window.clearTimeout(clearHeading)
    }
    // Intentionally once on mount for the handoff flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion])

  function handleExitToDashboard() {
    if (submitting) return
    if (isModal) {
      onRequestClose?.()
      return
    }
    beginCreatePoolExit(router, () => {
      setScreenMotionClass('create-mode-screen-exit')
    })
  }

  // Load once when the wizard mounts (modal or page). Re-entering step 1 must
  // not refetch into a loading frame — soft refresh only via retry CTA.
  useEffect(() => {
    void loadCreatableEvents()
  }, [loadCreatableEvents])


  useEffect(() => {
    if (step !== SUCCESS_STEP || !createdPool) return

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

  useEffect(() => {
    if (step !== SUCCESS_STEP || !createdPool) return
    goToPoolRef.current?.focus()
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

  /** Phase 1: quota is informational (tier for Commissioner branding only). */

  function handleSportSelect(sport: SportId) {
    setSelectedSport(sport)
    setSelectedEventId(null)
    setError(null)
  }

  function handleEventSelect(eventId: string) {
    setSelectedEventId(eventId)
    setError(null)
  }

  function handleContinueFromStep() {
    if (isSliding) return
    if (step === 1 && selectedSport && selectedEventId) {
      goToStep(2, 1)
      return
    }
    if (step === 2 && scoringStyle) {
      goToStep(3, 1)
      return
    }
    if (step === 3 && validatePoolName(poolName) === null) {
      goToStep(PLAN_STEP, 1)
      return
    }
    if (step === PLAN_STEP) {
      goToStep(REVIEW_STEP, 1)
    }
  }

  const navLocked = isSliding || submitting

  const canContinueStep = useMemo(() => {
    if (step === 1) {
      return (
        selectedSport !== null &&
        selectedEventId !== null &&
        eventsForSelectedSport.some((event) => event.id === selectedEventId)
      )
    }
    if (step === 2) return scoringStyle !== null
    if (step === 3) return validatePoolName(poolName) === null
    if (step === PLAN_STEP) return selectedPlan === 'basic' || selectedPlan === 'custom'
    return false
  }, [
    step,
    selectedSport,
    selectedEventId,
    eventsForSelectedSport,
    scoringStyle,
    poolName,
    selectedPlan,
  ])

  async function createPool() {
    if (!user || submitting) return
    if (checkoutPhase !== 'idle') return

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

    const trimmedName = normalizePoolName(poolName)
    const trimmedDescription = normalizePoolDescription(poolDescription)
    const normalizedTheme =
      selectedPlan === 'custom'
        ? normalizePoolThemeColor(themeColor) ?? themeColor
        : null

    saveCreateWizardState({
      step: REVIEW_STEP,
      selectedSport,
      selectedEventId,
      poolName,
      poolDescription,
      scoringStyle,
      isPublic,
      selectedPlan,
      themeColor: normalizedTheme,
      hasPendingEmblem: Boolean(emblemFile),
    })

    // Custom: draft → Stripe → webhook creates pool. No pool until congrats.
    if (selectedPlan === 'custom') {
      setLoadingMessage('Preparing checkout…')
      if (emblemFile) {
        await persistPendingEmblem(emblemFile)
      }

      const payload: PoolCreationDraftPayload = {
        name: trimmedName,
        description: trimmedDescription || null,
        scoringStyle,
        eventId: selectedEvent.id,
        eventName: selectedEvent.name,
        isPublic,
        themeColor: normalizedTheme,
        hasPendingEmblem: Boolean(emblemFile),
      }

      const checkout = await startDraftCustomPoolCheckout(payload)
      if (!checkout.ok) {
        setSubmitting(false)
        setLoadingMessage(null)
        setError(checkout.error || 'Could not start checkout. Please try again.')
        return
      }

      if (emblemFile) {
        await persistStagedEmblem(checkout.draftId, emblemFile)
      }

      setLoadingMessage('Redirecting to payment…')
      window.location.href = checkout.url
      return
    }

    setLoadingMessage('Creating pool…')

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
        is_public: isPublic,
      })
      .select('id, invite_code, is_public')
      .single()

    if (insertError || !pool) {
      setSubmitting(false)
      setLoadingMessage(null)
      // Deploy window: DB trigger may still exist — soft fail, no crash / no upgrade CTA.
      if (isPoolCreationLimitError(insertError)) {
        setError(POOL_CREATION_LIMIT_MESSAGE)
        return
      }
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

    const { awardClientXp } = await import('@/src/lib/xp-client')
    void awardClientXp({ sourceType: 'pool_create', sourceId: pool.id })

    clearCreateWizardState()
    clearStagedEmblem()

    setCreatedPool({
      id: pool.id,
      name: trimmedName,
      inviteCode: pool.invite_code,
    })
    capturePostHog('pool_created', {
      pool_id: pool.id,
      sport: normalizeSportKey(selectedEvent.sport),
      is_public: Boolean(pool.is_public),
      plan: 'basic',
    })

    setSubmitting(false)
    setLoadingMessage(null)
    goToStep(SUCCESS_STEP, 1)
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
    if (createdPool?.id) {
      capturePostHog('invite_link_copied', { pool_id: createdPool.id })
    }
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

  function renderCreatePoolReviewSummary(compact = false) {
    return (
      <div
        className={cn(
          'rounded-xl border border-[#1e2d3d] bg-[var(--dashboard-card-bg)]/70 px-4 py-3',
          compact ? 'mt-4' : 'mt-6',
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5a7080]">
          Your pool
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
              {selectedEvent
                ? (() => {
                    const { leagueName, seasonLabel } =
                      formatCreateFlowCompetitionDisplay(selectedEvent)
                    return seasonLabel
                      ? `${leagueName} · ${seasonLabel}`
                      : leagueName
                  })()
                : '—'}
            </dd>
          </div>
          {selectedEvent &&
          formatCreateFlowCompetitionDisplay(selectedEvent).seasonLabel == null &&
          (selectedEvent.start_date || selectedEvent.end_date) ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[#5a7080]">Season</dt>
              <dd className="text-right font-medium text-[#f0f4f8]">
                {formatSportingEventDateRange(
                  selectedEvent.start_date,
                  selectedEvent.end_date,
                )}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-[#5a7080]">Pool type</dt>
            <dd className="text-right font-medium text-[#f0f4f8]">
              {selectedScoring?.label ?? scoringStyle}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-[#1e2d3d] pt-1.5">
            <dt className="text-[#5a7080]">Pool name</dt>
            <dd className="text-right font-medium text-primary">
              {normalizePoolName(poolName) || '—'}
            </dd>
          </div>
          {normalizePoolDescription(poolDescription) ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[#5a7080]">Description</dt>
              <dd className="max-w-[60%] text-right font-medium text-[#f0f4f8]">
                {normalizePoolDescription(poolDescription)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-[#5a7080]">Visibility</dt>
            <dd className="text-right font-medium text-[#f0f4f8]">
              {isPublic ? 'Public' : 'Private'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#5a7080]">Plan</dt>
            <dd className="text-right font-medium text-[#f0f4f8]">
              {selectedPlan === 'custom'
                ? 'Upgraded ($9.99 one-time)'
                : 'Basic (Free)'}
            </dd>
          </div>
          {selectedPlan === 'custom' ? (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-[#5a7080]">Theme</dt>
                <dd className="flex items-center justify-end gap-2 font-medium text-[#f0f4f8]">
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-[#1e2d3d]"
                    style={{
                      backgroundColor:
                        themeColor ?? DEFAULT_POOL_THEME_COLOR,
                    }}
                    aria-hidden
                  />
                  {(themeColor ?? DEFAULT_POOL_THEME_COLOR).toUpperCase()}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#5a7080]">Logo</dt>
                <dd className="text-right font-medium text-[#f0f4f8]">
                  {emblemFile || emblemPreviewUrl
                    ? 'Staged — uploads after payment'
                    : 'None — add later in settings'}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>
    )
  }

  function renderStepScrollContent(panelStep: number) {
  return (
      <>
          {panelStep === 1 && (
            <CreateCompetitionStep
              layoutMode={isModal ? 'modal' : 'page'}
              selectedSport={selectedSport}
              selectedEventId={selectedEventId}
              creatableEvents={creatableEvents}
              eventsLoading={eventsLoading}
              eventsError={eventsError}
              headingStagger={headingStagger}
              onSelectSport={handleSportSelect}
              onSelectEvent={handleEventSelect}
              onRetryLoad={() => void loadCreatableEvents()}
            />
          )}

          {panelStep === 2 && (
            <div
              className={cn(
                // Modal: animated pane owns [scrollable cards | pinned disclaimer].
                isModal && 'flex h-full min-h-0 flex-col',
              )}
            >
              <div
                className={cn(
                  'mt-2 flex flex-col gap-3 lg:mt-0 lg:flex-row lg:items-stretch lg:gap-4',
                  isModal && 'min-h-0 flex-1 overflow-y-auto scrollbar-none',
                )}
              >
                {POOL_SCORING_STYLE_OPTIONS.map((style) => {
                  const selected = scoringStyle === style.id
                  const isClassic = style.id === 'classic'
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setScoringStyle(style.id)}
                      aria-pressed={selected}
                      className={cn(
                        'relative flex flex-1 flex-col rounded-xl',
                        isModal
                          ? 'items-center px-4 py-4 text-center'
                          : 'items-start p-5 text-left',
                        selectionTileClass(selected),
                        selected && 'hover:bg-transparent',
                      )}
                    >
                      <span
                        className={cn(
                          'flex items-center justify-center',
                          isModal
                            ? 'mb-2.5 h-[10.75rem] w-[10.75rem]'
                            : 'mb-4 h-12 w-12',
                        )}
                      >
                        {isModal ? (
                          /* eslint-disable-next-line @next/next/no-img-element -- static public mascot */
                          <img
                            src={
                              isClassic
                                ? '/mascot/pucky_score_predictor.png'
                                : '/mascot/pucky_winner_only.png'
                            }
                            alt=""
                            width={172}
                            height={172}
                            className="h-[10.75rem] w-[10.75rem] object-contain"
                            draggable={false}
                          />
                        ) : isClassic ? (
                          <ScorePredictorModeIcon className="h-12 w-12" />
                        ) : (
                          <WinnerOnlyModeIcon className="h-12 w-12" />
                        )}
                      </span>

                      <p className="text-base font-semibold tracking-wide text-[#f0f4f8]">
                        {style.label}
                      </p>
                      <p
                        className={cn(
                          'font-medium leading-snug text-[#f0f4f8]/90',
                          isModal ? 'mt-1.5 text-sm' : 'mt-2 text-sm',
                        )}
                      >
                        {style.tagline}
                      </p>
                      <p
                        className={cn(
                          'leading-snug text-[#F2C94C]',
                          isModal ? 'mt-1 text-xs' : 'mt-1.5 text-xs',
                        )}
                      >
                        {style.secondaryLine}
                      </p>

                      {isModal ? (
                        <div
                          className={cn(
                            'mt-4 w-full rounded-lg border border-[#1e2d3d]/80 bg-black/40 px-3 py-2 text-left',
                            'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
                          )}
                        >
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a7080]">
                            Points System
                          </p>
                          <ul
                            className={cn(
                              // Shared 3-row tall track so insets match; Winner Only centers its 2 rows under the eyebrow.
                              'flex min-h-[66px] flex-col gap-1.5',
                              isClassic ? 'justify-start' : 'justify-center',
                            )}
                          >
                            {style.scoringRows.map((row) => {
                              const Icon =
                                row.id === 'exact'
                                  ? Target
                                  : row.id === 'draw'
                                    ? Handshake
                                    : Check
                              return (
                                <li
                                  key={row.id}
                                  className="flex h-[18px] items-center justify-between gap-3"
                                >
                                  <span className="flex min-w-0 items-center gap-2 text-[12px] leading-none text-[#c5d0da]">
                                    <Icon
                                      className="h-3.5 w-3.5 shrink-0 text-[#5a7080]"
                                      aria-hidden
                                    />
                                    <span className="truncate">{row.label}</span>
                                  </span>
                                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-primary">
                                    {row.points}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {isModal ? (
                <p className="shrink-0 pt-3 text-center text-[12px] leading-snug text-[#5a7080]">
                  Want different scoring? Custom scoring is available with{' '}
                  <Link
                    href="/pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'font-medium text-[#F2C94C] underline-offset-2 hover:underline',
                      FOCUS_RING_CLASS,
                      'rounded-sm',
                    )}
                  >
                    Custom Pools
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          )}

          {panelStep === 3 && (
            <div
              className={cn(
                isModal ? 'flex h-full min-h-0 gap-5' : 'flex flex-col',
              )}
            >
              {isModal ? (
                <aside className="flex w-[42%] shrink-0 flex-col items-center justify-center px-2 text-center">
                  <div className="relative flex h-[clamp(13.75rem,36vh,16rem)] w-[clamp(13.75rem,36vh,16rem)] items-center justify-center">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-[-14%] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,230,118,0.16)_0%,rgba(167,139,250,0.06)_42%,transparent_68%)]"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-[12%] left-[8%] h-1.5 w-1.5 rounded-full bg-[#a78bfa]/45"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-[22%] right-[6%] h-1 w-1 rounded-full bg-[#22d3ee]/50"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-[18%] right-[14%] h-1.5 w-1.5 rounded-full bg-primary/35"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- static public mascot */}
                    <img
                      src="/mascot/pucky_hero.png"
                      alt=""
                      width={256}
                      height={256}
                      className="relative z-10 h-full w-full object-contain"
                      draggable={false}
                    />
                  </div>
                  <h2 className="mt-5 font-display text-2xl tracking-wide text-[#f0f4f8]">
                    Set up your pool
                  </h2>
                  <p className="mt-2 max-w-[16rem] text-sm leading-snug text-[#5a7080]">
                    Give your pool a name and decide who gets to join.
                  </p>
                </aside>
              ) : null}

              {isModal ? (
                <div
                  className="w-px shrink-0 self-stretch bg-white/[0.06]"
                  aria-hidden
                />
              ) : null}

              <div
                className={cn(
                  isModal
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-y-auto scrollbar-none py-1 pr-1'
                    : 'mt-0',
                )}
              >
                {!isModal ? (
                  <p className="text-sm text-[#5a7080]">
                    Give your pool a name and choose who can join.
                  </p>
                ) : null}

                <div
                  className={cn(
                    isModal ? 'flex w-full flex-col' : 'mt-8 max-w-xl space-y-5',
                  )}
                >
                  <div>
                    <label
                      htmlFor="pool-name"
                      className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#E5E7EB]"
                    >
                      Pool name
                    </label>
                    <div className="relative">
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
                        onFocus={() => setPoolNameFocused(true)}
                        onBlur={() => setPoolNameFocused(false)}
                        placeholder="Marketing Team WC 2026"
                        aria-invalid={Boolean(nameError)}
                        aria-describedby={
                          nameError ? 'pool-name-error' : 'pool-name-count'
                        }
                        className={cn(
                          'w-full rounded-xl border border-[#1e2d3d] bg-[var(--dashboard-card-bg)] py-3.5 pl-4 pr-14 text-[17px] leading-snug text-[#f0f4f8] placeholder:text-[#5a7080]/55',
                          'transition-[border-color,box-shadow] duration-160',
                          'focus:border-primary focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,230,118,0.2)]',
                        )}
                      />
                      <span
                        id="pool-name-count"
                        className={cn(
                          'pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px] tabular-nums text-[#5a7080]',
                          !(
                            poolNameFocused ||
                            poolName.length >= POOL_NAME_MAX_LENGTH - 10
                          ) && 'invisible',
                        )}
                        aria-live="polite"
                      >
                        {poolName.length}/{POOL_NAME_MAX_LENGTH}
                      </span>
                    </div>
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

                  <div className={cn(isModal && 'mt-7')}>
                    <label
                      htmlFor="pool-description"
                      className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#E5E7EB]"
                    >
                      Description (optional)
                    </label>
                    <div className="relative">
                      <textarea
                        id="pool-description"
                        rows={2}
                        maxLength={POOL_DESCRIPTION_MAX_LENGTH}
                        value={poolDescription}
                        onChange={(e) => {
                          setPoolDescription(e.target.value)
                          setDescriptionError(null)
                        }}
                        onFocus={() => setPoolDescriptionFocused(true)}
                        onBlur={() => setPoolDescriptionFocused(false)}
                        placeholder="Office World Cup pool — winner buys lunch"
                        aria-invalid={Boolean(descriptionError)}
                        aria-describedby={
                          descriptionError
                            ? 'pool-description-error'
                            : 'pool-description-count'
                        }
                        className={cn(
                          'w-full resize-none rounded-lg border border-[#1e2d3d] bg-[var(--dashboard-card-bg)]/70 px-3.5 py-2.5 pb-7 text-sm leading-snug text-[#f0f4f8]/90 placeholder:text-[#5a7080]/50',
                          'transition-[border-color,box-shadow] duration-160',
                          'focus:border-primary focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,230,118,0.18)]',
                        )}
                      />
                      <span
                        id="pool-description-count"
                        className={cn(
                          'pointer-events-none absolute right-3 bottom-2 text-[10px] tabular-nums text-[#5a7080]/90',
                          !(
                            poolDescriptionFocused ||
                            normalizePoolDescription(poolDescription).length >=
                              POOL_DESCRIPTION_MAX_LENGTH - 20
                          ) && 'invisible',
                        )}
                        aria-live="polite"
                      >
                        {normalizePoolDescription(poolDescription).length}/
                        {POOL_DESCRIPTION_MAX_LENGTH}
                      </span>
                    </div>
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

                  <div className={cn(isModal && 'mt-9')}>
                    <p className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#E5E7EB]">
                      Visibility
                    </p>
                    <div
                      role="group"
                      aria-label="Pool visibility"
                      className="create-pool-visibility-toggle"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'create-pool-visibility-toggle__thumb',
                          isPublic &&
                            'create-pool-visibility-toggle__thumb--public',
                        )}
                      />
                      <button
                        type="button"
                        disabled={submitting}
                        aria-pressed={!isPublic}
                        onClick={() => setIsPublic(false)}
                        className={cn(
                          'create-pool-visibility-toggle__segment',
                          FOCUS_RING_CLASS,
                          !isPublic
                            ? 'create-pool-visibility-toggle__segment--on'
                            : 'create-pool-visibility-toggle__segment--off',
                        )}
                      >
                        <Lock
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 create-pool-visibility-toggle__icon',
                            'create-pool-visibility-toggle__icon--private',
                          )}
                          aria-hidden
                        />
                        Private
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        aria-pressed={isPublic}
                        onClick={() => setIsPublic(true)}
                        className={cn(
                          'create-pool-visibility-toggle__segment',
                          FOCUS_RING_CLASS,
                          isPublic
                            ? 'create-pool-visibility-toggle__segment--on'
                            : 'create-pool-visibility-toggle__segment--off',
                        )}
                      >
                        <Globe
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 create-pool-visibility-toggle__icon',
                            'create-pool-visibility-toggle__icon--public',
                          )}
                          aria-hidden
                        />
                        Public
                      </button>
                    </div>
                    <div
                      className="create-pool-visibility-hint mt-3 grid justify-items-center"
                      aria-live="polite"
                    >
                      <p
                        className={cn(
                          'col-start-1 row-start-1 flex items-start justify-center gap-2 text-xs leading-snug text-[#f0f4f8]/90',
                          isPublic && 'invisible',
                        )}
                        aria-hidden={isPublic}
                      >
                        <Lock
                          className="mt-0.5 h-3 w-3 shrink-0 text-[#a78bfa]"
                          aria-hidden
                        />
                        <span>Only people with your invite can join.</span>
                      </p>
                      <p
                        className={cn(
                          'col-start-1 row-start-1 flex items-start justify-center gap-2 text-xs leading-snug text-[#f0f4f8]/90',
                          !isPublic && 'invisible',
                        )}
                        aria-hidden={!isPublic}
                      >
                        <Globe
                          className="mt-0.5 h-3 w-3 shrink-0 text-[#22d3ee]"
                          aria-hidden
                        />
                        <span>Anyone can discover and join.</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {panelStep === PLAN_STEP && (
            <>
              <p className="text-sm text-[#5a7080]">
                Basic is free. Upgrade once for branding — no subscription.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                  onClick={() => setSelectedPlan('basic')}
                  className={cn(
                    'rounded-xl border px-4 py-4 text-left transition-colors',
                    FOCUS_RING_CLASS,
                    selectedPlan === 'basic'
                      ? 'border-primary bg-primary/10'
                      : 'border-[#1e2d3d] bg-[var(--dashboard-card-bg)]/40 hover:border-[#2a3d52]',
                  )}
                  aria-pressed={selectedPlan === 'basic'}
                >
                  <p className="font-semibold text-[#f0f4f8]">Basic</p>
                  <p className="mt-1 text-sm font-semibold text-primary">Free</p>
                  <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-[#5a7080]">
                    {[
                      'Predictions',
                      'Leaderboard',
                      'Invites',
                      'Chat',
                      'Standard management',
                    ].map((item) => (
                      <li key={item} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary"
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                    </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan('custom')}
                  className={cn(
                    'rounded-xl border px-4 py-4 text-left transition-colors',
                    FOCUS_RING_CLASS,
                    selectedPlan === 'custom'
                      ? 'border-primary bg-primary/10'
                      : 'border-[#1e2d3d] bg-[var(--dashboard-card-bg)]/40 hover:border-[#2a3d52]',
                  )}
                  aria-pressed={selectedPlan === 'custom'}
                >
                  <p className="font-semibold text-[#f0f4f8]">Upgraded</p>
                  <p className="mt-1 text-sm font-semibold text-primary">
                    $9.99 one-time · No subscription.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#5a7080]">
                    Everything in Basic, plus:
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[#5a7080]">
                    {[
                      'Custom logo',
                      'Theme color',
                      'Custom scoring',
                      'Announcements & polls',
                      'Co-commissioners',
                      'Moderation & exports',
                    ].map((item) => (
                      <li key={item} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary"
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              </div>

              {selectedPlan === 'custom' ? (
                <div className="mt-6 space-y-4 rounded-xl border border-[#1e2d3d] bg-[var(--dashboard-card-bg)]/50 px-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-[#f0f4f8]">
                      Stage branding (optional)
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#5a7080]">
                      Theme applies when your pool is created after payment. Logo
                      uploads once the pool exists — if you close this tab after
                      paying, add it later in pool settings.
                    </p>
              </div>

                <div>
                  <label
                      htmlFor={emblemInputId}
                      className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#5a7080]"
                  >
                      Pool logo
                  </label>
                  <input
                      ref={emblemInputRef}
                      id={emblemInputId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        if (!file) return
                        setEmblemFile(file)
                        const url = URL.createObjectURL(file)
                        setEmblemPreviewUrl((prev) => {
                          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
                          return url
                        })
                        void persistPendingEmblem(file)
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      {emblemPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={emblemPreviewUrl}
                          alt=""
                          className="h-14 w-14 rounded-lg object-cover ring-1 ring-[#1e2d3d]"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-[#2a3d52] text-[10px] text-[#5a7080]">
                          None
                </div>
                      )}
                      <button
                        type="button"
                        className={cn(
                          'rounded-lg border border-[#1e2d3d] px-3 py-1.5 text-xs font-medium text-[#e8eef4] hover:border-primary/50',
                          FOCUS_RING_CLASS,
                        )}
                        onClick={() => emblemInputRef.current?.click()}
                      >
                        {emblemFile ? 'Change logo' : 'Choose logo'}
                      </button>
                      {emblemFile ? (
                        <button
                          type="button"
                          className={cn(
                            'text-xs font-medium text-[#5a7080] hover:text-[#e8eef4]',
                            FOCUS_RING_CLASS,
                            'rounded-md',
                          )}
                          onClick={() => {
                            setEmblemFile(null)
                            setEmblemPreviewUrl((prev) => {
                              if (prev?.startsWith('blob:')) {
                                URL.revokeObjectURL(prev)
                              }
                              return null
                            })
                            clearStagedEmblem()
                            if (emblemInputRef.current) {
                              emblemInputRef.current.value = ''
                            }
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                  </div>
                  </div>

                  <div>
                    <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#5a7080]">
                      Theme color
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {POOL_THEME_COLOR_PRESETS.map((preset) => {
                        const selected =
                          (themeColor ?? DEFAULT_POOL_THEME_COLOR).toLowerCase() ===
                          preset.hex.toLowerCase()
                    return (
                          <button
                            key={preset.id}
                            type="button"
                            title={preset.label}
                            aria-label={preset.label}
                            aria-pressed={selected}
                            onClick={() => setThemeColor(preset.hex)}
                            className={cn(
                              'h-8 w-8 rounded-full border-2 transition-transform',
                              FOCUS_RING_CLASS,
                              selected
                                ? 'scale-110 border-white'
                                : 'border-transparent opacity-80 hover:opacity-100',
                            )}
                            style={{ backgroundColor: preset.hex }}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {panelStep === REVIEW_STEP && (
            <>
              <p className="text-sm text-[#5a7080]">
                One last look before you go live.
              </p>

              {renderCreatePoolReviewSummary(true)}

              {selectedScoring ? (
                <div className="mt-6 space-y-3">
                  <span className="block text-xs font-medium uppercase tracking-wider text-[#5a7080]">
                    Scoring rules
                  </span>
                  <div className="rounded-lg border border-[#1e2d3d] bg-[var(--dashboard-card-bg)]/60 px-4 py-3">
                        <ul className="space-y-1.5 text-sm text-[#5a7080]">
                      {selectedScoring.rules.map((rule) => (
                            <li key={rule}>{rule}</li>
                          ))}
                        </ul>
                    <p className="mt-2 text-xs font-medium text-primary">
                      {selectedScoring.tagline}
                        </p>
                      </div>
                </div>
              ) : null}

              <p className="mt-6 rounded-lg border border-[#1e2d3d]/80 bg-[var(--dashboard-card-bg)]/40 px-3 py-2.5 text-xs leading-relaxed text-[#5a7080]">
                Predictions lock when each match kicks off. Advanced scoring and
                commissioner tools live in pool settings after creation
                {selectedPlan === 'custom' ? ' (included with Upgraded)' : ''}.
              </p>

              <form
                id="create-pool-form"
                onSubmit={(e) => void handleSubmit(e)}
                className="mt-6"
              >
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
                        'mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline',
                        FOCUS_RING_CLASS,
                        'rounded-md',
                      )}
                    >
                      Try again
                </button>
                  </div>
                ) : null}
              </form>
            </>
          )}

          {panelStep === SUCCESS_STEP && createdPool && (
            <>
              {/* —— Mobile (< lg): current stacked congrats — do not change —— */}
              <div className="lg:hidden">
                <p className="text-sm text-[#5a7080]">
                  Pools are no fun solo. Invite people to play against you.
                </p>

                <div className="mt-4 flex items-center justify-center gap-2 text-primary">
                  <Zap className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-sm font-semibold">+5 points earned!</span>
                </div>

                <div className="mt-5 flex flex-col items-center">
                  <p className="text-xs text-[#5a7080]">Scan to join</p>
                  <div className="mt-2 rounded-xl bg-white p-3">
                    <QRCodeSVG value={inviteLink} {...INVITE_QR_PROPS} />
                  </div>
                  <button
                    type="button"
                    onClick={downloadInviteQr}
                    className={cn(
                      'mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#1e2d3d] px-3 py-1.5 text-xs font-medium text-[#e8eef4] transition-colors hover:border-primary/50 hover:bg-[var(--dashboard-card-bg)] hover:text-primary',
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

                <div className="mt-5">
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
                    className="w-full rounded-lg border border-[#1e2d3d] bg-[var(--dashboard-card-bg)] px-4 py-3 text-sm text-[#f0f4f8] focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void shareInvite()}
                  className={cn('mt-6', PRIMARY_CTA_CLASS)}
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

                <a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    capturePostHog('discord_cta_clicked', {
                      source: 'pool_created',
                    })
                  }}
                  className={cn(
                    'mt-4 inline-flex max-w-full items-center gap-1.5 text-left text-xs leading-snug text-[#5a7080] transition-colors hover:text-[#f0f4f8]',
                    FOCUS_RING_CLASS,
                    'rounded-md',
                  )}
                >
                  <DiscordMarkIcon
                    className="h-3.5 w-3.5 shrink-0 text-[#5865F2]"
                    size={14}
                  />
                  <span>
                    You&apos;re a commissioner now —{' '}
                    <span className="font-semibold text-[#5865F2]">
                      join the Discord →
                    </span>
                  </span>
                </a>
              </div>

              {/* —— Desktop (lg+): composed two-column congrats —— */}
              <div className="hidden lg:block">
                <div className="text-center">
                  <h2 className="font-display text-4xl tracking-wide text-[#f0f4f8]">
                    Pool Created 🎉
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[#5a7080]">
                    Pools are no fun solo. Invite people to play against you.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2 text-primary">
                    <Zap className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="text-sm font-semibold">
                      +5 points earned!
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 items-start gap-6">
                  {/* Left — QR + invite link */}
                  <div className="flex flex-col items-center">
                    <p className="text-xs text-[#5a7080]">Scan to join</p>
                    <div className="mt-2 rounded-xl bg-white p-3">
                      <QRCodeSVG value={inviteLink} {...INVITE_QR_PROPS} />
                    </div>
                    <button
                      type="button"
                      onClick={downloadInviteQr}
                      className={cn(
                        'mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#1e2d3d] px-3 py-1.5 text-xs font-medium text-[#e8eef4] transition-colors hover:border-primary/50 hover:bg-[var(--dashboard-card-bg)] hover:text-primary',
                        FOCUS_RING_CLASS,
                      )}
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Download QR
                    </button>

                    <div className="mt-4 w-full">
                      <label
                        htmlFor="invite-link-desktop"
                        className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5a7080]"
                      >
                        Invite link
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="invite-link-desktop"
                          type="text"
                          readOnly
                          value={inviteLink}
                          onFocus={(e) => e.target.select()}
                          className="min-w-0 flex-1 rounded-lg border border-[#1e2d3d] bg-[var(--dashboard-card-bg)] px-3 py-2.5 text-sm text-[#f0f4f8] focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        />
                        <button
                          type="button"
                          onClick={copyInviteLink}
                          className={cn(
                            'shrink-0 rounded-lg border border-[#1e2d3d] px-3 py-2.5 text-xs font-semibold text-[#e8eef4] transition-colors hover:border-primary/50 hover:text-primary',
                            FOCUS_RING_CLASS,
                          )}
                        >
                          {linkCopied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right — Share primary + Discord secondary card */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => void shareInvite()}
                      className={PRIMARY_CTA_CLASS}
                    >
                      Share invite
                    </button>
                    <p className="mt-1.5 text-center text-[11px] text-[#5a7080]">
                      Uses your device share sheet, or copies the link
                    </p>

                    <div className="mt-4 rounded-xl border border-[#1e2d3d] bg-[var(--dashboard-card-bg)]/80 p-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]/15 text-[#5865F2]">
                          <DiscordMarkIcon className="h-4 w-4" size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#f0f4f8]">
                            You&apos;re a commissioner now
                          </p>
                          <p className="mt-1 text-xs leading-snug text-[#5a7080]">
                            Join the PoolCup Discord to talk strategy, catch live
                            match alerts, and shape what we build next.
                          </p>
                          <a
                            href={DISCORD_INVITE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              capturePostHog('discord_cta_clicked', {
                                source: 'pool_created',
                              })
                            }}
                            className={cn(
                              'mt-2 inline-flex text-sm font-semibold text-[#5865F2] transition-colors hover:text-[#4752C4]',
                              FOCUS_RING_CLASS,
                              'rounded-md',
                            )}
                          >
                            Join the community →
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strong final CTA under the two columns */}
                <Button
                  asChild
                  size="lg"
                  className={cn(CREATE_POOL_BTN_PRIMARY_CLASS, 'mt-6')}
                >
                  <Link
                    ref={(el) => {
                      if (el && el.getClientRects().length > 0) {
                        goToPoolRef.current = el
                      }
                    }}
                    href={`/pool/${createdPool.inviteCode}`}
                  >
                    Open Pool
                  </Link>
                </Button>
              </div>
            </>
          )}
      </>
    )
  }

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-[#5a7080]">Loading…</p>
      </main>
    )
  }

  const isSuccessPage =
    checkoutPhase !== 'idle' || step >= SUCCESS_STEP
  const chromeTitle = isSuccessPage
    ? SUCCESS_CHROME_TITLE
    : chromeTitleForStep(step)
  const poolHref = createdPool
    ? `/pool/${createdPool.inviteCode}`
    : '/dashboard'

  return (
    <main
      className={cn(
        isModal ? 'contents' : cn('min-h-dvh bg-background', screenMotionClass),
      )}
    >
      <div
        className={cn(
          isModal ? 'contents' : 'relative flex min-h-0 h-full w-full flex-col',
        )}
      >
        <div className={cn(isModal ? 'contents' : 'flex min-h-0 w-full flex-col')}>
          <div
            className={
              isModal ? CREATE_POOL_CARD_MODAL_CLASS : CREATE_POOL_CARD_PAGE_CLASS
            }
          >
            <button
              type="button"
              onClick={handleExitToDashboard}
              disabled={submitting}
              aria-label="Close create pool"
              className={cn(
                'absolute right-3 top-3 z-20 h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50',
                isModal ? 'inline-flex' : 'hidden',
                FOCUS_RING_CLASS,
              )}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>

            <header className="shrink-0">
              <div className={cn('space-y-3', isModal && 'hidden')}>
                <div className="relative flex min-h-11 items-center">
                  {isSuccessPage ? (
                    <Link
                      href={poolHref}
                      className={cn(
                        'relative z-10 flex h-9 max-w-[7.5rem] shrink-0 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                        FOCUS_RING_CLASS,
                      )}
                    >
                      <span aria-hidden className="text-lg leading-none">
                        ←
                      </span>
                      <span className="truncate">
                        {createdPool ? 'Go to pool' : 'Dashboard'}
                      </span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleExitToDashboard}
                      disabled={submitting}
                      className={cn(
                        'relative z-10 flex h-9 shrink-0 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50',
                        FOCUS_RING_CLASS,
                      )}
                    >
                      <span aria-hidden className="text-lg leading-none">
                        ←
                      </span>
                      Exit
                    </button>
                  )}
                  <p className="pointer-events-none absolute inset-x-0 text-center font-display text-base tracking-wide text-[#f0f4f8] sm:text-lg">
                    {chromeTitle}
                  </p>
                  <span
                    className="relative z-10 ml-auto w-[4.25rem] shrink-0"
                    aria-hidden
                  />
                </div>
                {!isSuccessPage ? (
                  <CreatePoolStepper currentStep={step} labelMode="all" />
                ) : null}
              </div>

              <div className={cn('px-10 text-center', !isModal && 'hidden')}>
                {!isSuccessPage ? (
                  <CreatePoolStepper currentStep={step} labelMode="all" />
                ) : null}
                <h1
                  className={cn(
                    'font-display text-2xl tracking-wide text-foreground',
                    !isSuccessPage && 'mt-8',
                    // Step 3 modal: title lives in the left brand column instead.
                    isModal &&
                      step === 3 &&
                      !isSuccessPage &&
                      'hidden',
                  )}
                >
                  {chromeTitle}
                </h1>
              </div>
            </header>

          <div
            ref={slideViewportRef}
            className={cn(
              // overflow-hidden clips the dual-pane translateX slide.
              // Modal: mt-8 — balanced rhythm under instructional title; flex-1 body absorbs it.
              'flex min-h-0 flex-col overflow-hidden',
              isModal ? (step === 3 ? 'mt-5' : 'mt-8') : 'mt-4',
              isModal
                ? 'min-h-0 flex-1 basis-0'
                : slideLockPx != null
                  ? 'flex-none'
                  : 'flex-1 lg:flex-none',
            )}
            style={
              !isModal && slideLockPx != null
                ? { height: slideLockPx, flexGrow: 0, flexShrink: 0 }
                : undefined
            }
          >
            {checkoutPhase === 'finalizing' || checkoutPhase === 'slow' ? (
              <div className="flex h-full min-h-0 flex-col items-center justify-center px-2 text-center">
                <Loader2
                  className="h-8 w-8 animate-spin text-primary"
                  aria-hidden
                />
                <p className="mt-4 text-sm font-medium text-[#f0f4f8]">
                  Finalizing your pool
                </p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#5a7080]">
                  {finalizingMessage}
                </p>
                {checkoutPhase === 'slow' ? (
                  <Link
                    href="/dashboard"
                    className={cn(
                      'mt-6 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline',
                      FOCUS_RING_CLASS,
                      'rounded-md',
                    )}
                  >
                    Go to your pools
                  </Link>
                ) : null}
              </div>
            ) : (
            <div
              className={cn(
                'flex min-h-0 w-[200%] will-change-transform',
                isModal
                  ? 'h-full min-h-0 flex-1'
                  : slideLockPx != null
                    ? 'h-full flex-1'
                    : 'h-full flex-1 lg:h-auto lg:flex-none',
              )}
              style={{
                transform: `translateX(${trackX}%)`,
                ...createPoolSlideMotionStyle('transform', trackTransition),
              }}
            >
              <div
                className={cn(
                  'flex w-1/2 shrink-0 flex-col overflow-x-hidden px-1.5',
                  isModal
                    ? 'h-full min-h-0 overflow-hidden'
                    : slideLockPx != null
                      ? 'h-full min-h-0 overflow-y-auto scrollbar-none'
                      : 'h-full min-h-0 overflow-y-auto scrollbar-none lg:h-auto',
                  isSliding && 'pointer-events-none will-change-[opacity]',
                )}
                style={{
                  opacity: leftOpacity,
                  ...createPoolSlideMotionStyle('opacity', trackTransition),
                }}
              >
                <div
                  className={cn(
                    'flex min-h-0 flex-1 flex-col',
                    // Step 2 modal scrolls inside its own column; other steps scroll here.
                    !(isModal && leftPanelStep === 2) &&
                      isModal &&
                      'overflow-y-auto scrollbar-none',
                  )}
                >
                  {renderStepScrollContent(leftPanelStep)}
                </div>
              </div>
              <div
                className={cn(
                  'pointer-events-none flex w-1/2 shrink-0 flex-col overflow-x-hidden px-1.5',
                  isModal
                    ? 'h-full min-h-0 overflow-hidden'
                    : slideLockPx != null
                      ? 'h-full min-h-0 overflow-y-auto scrollbar-none'
                      : 'h-full min-h-0 overflow-y-auto scrollbar-none lg:h-auto',
                  isSliding && 'will-change-[opacity]',
                )}
                style={{
                  opacity: rightOpacity,
                  ...createPoolSlideMotionStyle('opacity', trackTransition),
                }}
                aria-hidden={!rightPanelStep}
              >
                {rightPanelStep ? (
                  <div
                    className={cn(
                      'flex min-h-0 flex-1 flex-col',
                      !(isModal && rightPanelStep === 2) &&
                        isModal &&
                        'overflow-y-auto scrollbar-none',
                    )}
                  >
                    {renderStepScrollContent(rightPanelStep)}
                  </div>
                ) : null}
              </div>
            </div>
            )}
          </div>

          <footer
            className={cn(
              CREATE_POOL_FOOTER_CLASS,
              isModal
                ? // Pinned nav only — step-2 disclaimer lives in the animated pane.
                  'shrink-0'
                : CREATE_POOL_FOOTER_DESKTOP_SLOT_CLASS,
            )}
          >
            {checkoutPhase === 'idle' && step === 1 ? (
              <CreatePoolNavFooter
                showBack={false}
                continueLabel="Continue"
                continueDisabled={!canContinueStep || navLocked}
                onContinue={handleContinueFromStep}
              />
            ) : null}

            {checkoutPhase === 'idle' && step === 2 ? (
              <CreatePoolNavFooter
                showBack
                backDisabled={navLocked}
                onBack={() => goToStep(1, -1)}
                continueLabel="Continue"
                continueDisabled={!canContinueStep || navLocked}
                onContinue={handleContinueFromStep}
              />
            ) : null}

            {checkoutPhase === 'idle' && step === 3 ? (
              <CreatePoolNavFooter
                showBack
                backDisabled={navLocked}
                onBack={() => goToStep(2, -1)}
                continueLabel="Continue"
                continueDisabled={!canContinueStep || navLocked}
                onContinue={handleContinueFromStep}
              />
            ) : null}

            {checkoutPhase === 'idle' && step === PLAN_STEP ? (
              <CreatePoolNavFooter
                showBack
                backDisabled={navLocked}
                onBack={() => goToStep(3, -1)}
                continueLabel="Continue"
                continueDisabled={!canContinueStep || navLocked}
                onContinue={handleContinueFromStep}
              />
            ) : null}

            {checkoutPhase === 'idle' && step === REVIEW_STEP ? (
              <CreatePoolNavFooter
                showBack
                backDisabled={navLocked}
                onBack={() => goToStep(PLAN_STEP, -1)}
                continueLabel={
                  submitting
                    ? (loadingMessage ?? 'Creating pool…')
                    : 'Create Pool'
                }
                continueDisabled={
                  navLocked ||
                  submitting ||
                  validatePoolName(poolName) !== null ||
                  !selectedEventId
                }
                continueType="submit"
                continueForm="create-pool-form"
              />
            ) : null}

            {checkoutPhase === 'idle' &&
            step === SUCCESS_STEP &&
            createdPool ? (
              <Button
                asChild
                size="lg"
  // Open Pool CTA — show on mobile page footer; modal has it in-content on desktop.
                className={cn(CREATE_POOL_BTN_PRIMARY_CLASS, !isModal && 'lg:hidden')}
              >
                <Link
                  ref={(el) => {
                    if (el && el.getClientRects().length > 0) {
                      goToPoolRef.current = el
                    }
                  }}
                  href={`/pool/${createdPool.inviteCode}`}
                >
                  Open Pool
                </Link>
              </Button>
            ) : null}
          </footer>
        </div>
      </div>
      </div>

    </main>
  )
}

export function CreatePoolWizardSuspense(props: CreatePoolWizardProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-background">
          <p className="text-[#5a7080]">Loading…</p>
        </main>
      }
    >
      <CreatePoolWizard {...props} />
    </Suspense>
  )
}
