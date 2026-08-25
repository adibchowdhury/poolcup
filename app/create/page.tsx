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
import { Check, Download, Loader2, Target, Trophy, Zap } from 'lucide-react'
import confetti from 'canvas-confetti'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
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
import { cn } from '@/lib/utils'
import {
  formatOfficialLeagueName,
  formatOfficialSeasonLabel,
} from '@/src/lib/fetch-official-pools'

const CREATE_POOL_STEPS = [
  { id: 'competition' as const, chromeTitle: 'Competition' },
  { id: 'type' as const, chromeTitle: 'Pool Type' },
  { id: 'details' as const, chromeTitle: 'Pool Details' },
  { id: 'plan' as const, chromeTitle: 'Choose Your Pool' },
  { id: 'review' as const, chromeTitle: 'Review & Create' },
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

/** Desktop: fixed card height. Mobile: full viewport (no bordered box). */
const CREATE_POOL_SHELL_HEIGHT_CLASS =
  'h-dvh lg:h-[min(720px,calc(100dvh-7rem))]'
const CREATE_POOL_SHELL_WIDTH_CLASS = 'w-full lg:max-w-2xl'
const CREATE_POOL_CARD_CLASS = cn(
  'flex min-h-0 flex-col bg-transparent px-4 pt-4',
  'pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
  'lg:rounded-2xl lg:border-2 lg:border-[#292929] lg:p-8',
  CREATE_POOL_SHELL_HEIGHT_CLASS,
)

const FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'

/** Step section titles — same 2xl on mobile; former 3xl headings stay 3xl from lg up. */
const CREATE_POOL_STEP_HEADING_CLASS =
  'font-display text-2xl tracking-wide text-[#f0f4f8]'

/** Pinned CTA row. Desktop keeps a tall slot when chrome owns the CTA; mobile hugs content. */
const CREATE_POOL_FOOTER_CLASS =
  'flex shrink-0 flex-col justify-end pt-4 max-lg:min-h-0'
const CREATE_POOL_FOOTER_DESKTOP_SLOT_CLASS = 'lg:min-h-[8.75rem]'

const CREATE_POOL_BTN_BACK_CLASS = cn(
  'ui-tactile-btn w-[38%] min-w-0 shrink-0 font-semibold text-foreground',
  '[-webkit-tap-highlight-color:transparent] touch-manipulation select-none',
  'bg-[linear-gradient(180deg,#243044,#111a27)]',
  'hover:bg-[linear-gradient(180deg,#243044,#111a27)]',
  'active:bg-[linear-gradient(180deg,#243044,#111a27)]',
  'disabled:pointer-events-none disabled:opacity-50',
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
        'flex w-full items-stretch gap-3 pb-1.5 pr-1.5 [-webkit-tap-highlight-color:transparent]',
        !showBack && 'justify-center',
      )}
    >
      {showBack ? (
        <Button
          type="button"
          size="lg"
          className={cn(CREATE_POOL_BTN_BACK_CLASS, 'hidden lg:inline-flex')}
          disabled={backDisabled}
          onClick={onBack}
        >
          Back
        </Button>
      ) : null}
      <div
        className={cn(
          showBack
            ? 'min-w-0 flex-1 max-lg:w-full'
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
  'w-full rounded-lg border border-[#1e2d3d] px-2 py-1.5 text-[10px] font-medium text-[#5a7080] transition-colors hover:border-[#1e2d3d] hover:bg-[#080b0f] hover:text-[#f0f4f8] sm:text-xs sm:px-2',
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

/** Always green — progress is shown on circles, not line fill. */
function CreatePoolStepConnector() {
  return (
    <div
      className="h-0.5 min-w-[0.375rem] flex-1 shrink self-center bg-[#00e676] -mx-px"
      aria-hidden
    />
  )
}

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
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-transparent"
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
        'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2',
        motion,
      )}
      style={{
        borderColor: STEPPER_GREEN,
        backgroundColor: isCompleted ? STEPPER_GREEN : 'transparent',
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

/** Numbered circles only — five wizard steps; success has no progress bar. */
function CreatePoolStepper({ currentStep }: { currentStep: number }) {
  const reducedMotion = usePrefersReducedMotion()
  const totalSteps = STEPPER_STEP_COUNT
  const animate = !reducedMotion
  const displayStep = Math.min(Math.max(currentStep, 1), totalSteps)

  return (
    <nav
      className="flex w-full justify-center px-1"
      aria-label="Pool creation progress"
    >
      <ol
        className="flex w-[94%] min-w-0 max-w-full list-none items-center gap-0 p-0 m-0 sm:w-[68%] sm:min-w-[17rem]"
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

          return (
            <li
              key={poolStep.id}
              className={cn(
                'flex items-center gap-0',
                index > 0 ? 'min-w-0 flex-1' : 'shrink-0',
              )}
              aria-label={`Step ${stepNumber} of ${totalSteps}`}
            >
              {index > 0 ? <CreatePoolStepConnector /> : null}
              <CreatePoolStepCircle
                stepNumber={stepNumber}
                status={status}
                animate={animate}
              />
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
    'bg-[#080b0f]',
    selected
      ? 'border-2 border-primary ring-2 ring-primary/40'
      : 'border border-[#1e2d3d] hover:border-primary/50',
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

function CreatePoolPageInner() {
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
  const [publicConfirmOpen, setPublicConfirmOpen] = useState(false)
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
    return () => {
      for (const id of slideTimersRef.current) window.clearTimeout(id)
      slideTimersRef.current = []
    }
  }, [])

  const goToStep = useCallback(
    (next: number, dir: 1 | -1) => {
      if (next === step || isSliding || next < 1 || next > TOTAL_FLOW_STEPS) return

      if (prefersReducedMotion) {
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
      const startLeft = dir === 1 ? 1 : 0
      const startRight = dir === 1 ? 0 : 1
      const endLeft = dir === 1 ? 0 : 1
      const endRight = dir === 1 ? 1 : 0

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
        cancelAnimationFrame(rafEnable)
        cancelAnimationFrame(rafEnd)
      }, STEP_TRANSITION_MS)
      slideTimersRef.current.push(doneTimer)
    },
    [isSliding, prefersReducedMotion, step],
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
    const checkout = searchParams.get('checkout')
    if (!checkout) return
    checkoutHandledRef.current = true

    if (checkout === 'cancel') {
      const saved = loadCreateWizardState()
      if (saved) applyWizardState({ ...saved, step: REVIEW_STEP })
      else {
        setStep(REVIEW_STEP)
        setLeftPanelStep(REVIEW_STEP)
        setRightPanelStep(createPoolNextStep(REVIEW_STEP))
      }
      router.replace('/create', { scroll: false })
      return
    }

    if (checkout === 'success') {
      const draftId = searchParams.get('draft_id')?.trim()
      if (!draftId) {
        setError('Missing checkout draft. Check your pools shortly.')
        router.replace('/create', { scroll: false })
        return
      }
      setFinalizingDraftId(draftId)
      setCheckoutPhase('finalizing')
      setFinalizingMessage('Payment received — setting up your pool')
      setStep(SUCCESS_STEP)
      setLeftPanelStep(SUCCESS_STEP)
      setRightPanelStep(null)
    }
  }, [applyWizardState, router, searchParams])

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
    beginCreatePoolExit(router, () => {
      setScreenMotionClass('create-mode-screen-exit')
    })
  }

  useEffect(() => {
    if (step !== 1) return
    void loadCreatableEvents()
  }, [step, loadCreatableEvents])


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
          'rounded-xl border border-[#1e2d3d] bg-[#080b0f]/70 px-4 py-3',
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
            <>
              <p className="text-sm text-[#5a7080]">
                How should members earn points in this pool?
              </p>

              <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
                {POOL_SCORING_STYLE_OPTIONS.map((style) => {
                  const selected = scoringStyle === style.id
                  const Icon = style.id === 'classic' ? Target : Trophy
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setScoringStyle(style.id)}
                      className={cn(
                        'flex flex-1 flex-col rounded-xl border p-4 text-left transition-all',
                        selectionTileClass(selected),
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-[#080b0f]',
                            selected
                              ? 'border-primary text-primary'
                              : 'border-[#1e2d3d] text-[#5a7080]',
                          )}
                          aria-hidden
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            selected ? 'text-primary' : 'text-[#f0f4f8]',
                          )}
                        >
                          {style.label}
                        </p>
                      </div>
                      <p className="mt-3 text-sm leading-snug text-[#5a7080]">
                        {style.tagline}
                      </p>
                      <ul className="mt-3 space-y-1.5 text-xs leading-snug text-[#5a7080]">
                        {style.highlights.map((line) => (
                          <li key={line} className="flex gap-2">
                            <span
                              className={cn(
                                'mt-1.5 h-1 w-1 shrink-0 rounded-full',
                                selected ? 'bg-primary' : 'bg-[#5a7080]',
                              )}
                              aria-hidden
                            />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {panelStep === 3 && (
            <>
              <p className="text-sm text-[#5a7080]">
                Name your pool and choose who can find it.
              </p>

              <div className="mt-8 space-y-6">
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
                      'w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
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
                      'w-full resize-y rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
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

                <div className="flex items-start justify-between gap-4 rounded-xl border border-[#1e2d3d] bg-[#080b0f]/70 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <label
                      htmlFor="create-pool-public"
                      className="text-sm font-medium text-[#f0f4f8]"
                    >
                      Make this pool public
                    </label>
                    <p
                      id="create-pool-public-help"
                      className="text-xs leading-relaxed text-[#5a7080]"
                    >
                      Anyone can find and join this pool from Discover.
                    </p>
                  </div>
                  <Switch
                    id="create-pool-public"
                    checked={isPublic}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setPublicConfirmOpen(true)
                        return
                      }
                      setIsPublic(false)
                    }}
                    disabled={submitting}
                    aria-describedby="create-pool-public-help"
                  />
                </div>
              </div>
            </>
          )}

          {panelStep === PLAN_STEP && (
            <>
              <p className="text-sm text-[#5a7080]">
                Basic is free forever. Upgrade once for branding and commissioner
                tools — no subscription.
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
                      : 'border-[#1e2d3d] bg-[#080b0f]/40 hover:border-[#2a3d52]',
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
                      : 'border-[#1e2d3d] bg-[#080b0f]/40 hover:border-[#2a3d52]',
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
                <div className="mt-6 space-y-4 rounded-xl border border-[#1e2d3d] bg-[#080b0f]/50 px-4 py-4">
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
                Confirm everything looks right, then create your pool.
              </p>

              {renderCreatePoolReviewSummary(true)}

              {selectedScoring ? (
                <div className="mt-6 space-y-3">
                  <span className="block text-xs font-medium uppercase tracking-wider text-[#5a7080]">
                    Scoring rules
                  </span>
                  <div className="rounded-lg border border-[#1e2d3d] bg-[#080b0f]/60 px-4 py-3">
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

              <p className="mt-6 rounded-lg border border-[#1e2d3d]/80 bg-[#080b0f]/40 px-3 py-2.5 text-xs leading-relaxed text-[#5a7080]">
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
              <p className="text-sm text-[#5a7080]">
                Pools are no fun solo. Invite people to play against you.
              </p>

              <div className="mt-6 flex items-center justify-center gap-2 text-primary">
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
                    'mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#1e2d3d] px-3 py-1.5 text-xs font-medium text-[#e8eef4] transition-colors hover:border-primary/50 hover:bg-[#080b0f] hover:text-primary',
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
                  className="w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-sm text-[#f0f4f8] focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
        'min-h-dvh bg-background lg:flex lg:min-h-screen lg:items-center lg:justify-center lg:px-4 lg:py-10',
        screenMotionClass,
      )}
    >
      <div className={cn('flex min-h-0 w-full flex-col', CREATE_POOL_SHELL_WIDTH_CLASS)}>
        <div className={CREATE_POOL_CARD_CLASS}>
          <header className="shrink-0 space-y-3 lg:space-y-4">
            <div className="space-y-3">
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
                <span className="relative z-10 ml-auto w-[4.25rem] shrink-0" aria-hidden />
              </div>
              {!isSuccessPage ? (
                <CreatePoolStepper currentStep={step} />
              ) : null}
            </div>
          </header>

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
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
              className="flex h-full min-h-0 w-[200%] flex-1 will-change-transform"
              style={{
                transform: `translateX(${trackX}%)`,
                ...createPoolSlideMotionStyle('transform', trackTransition),
              }}
            >
              <div
                className={cn(
                  // Horizontal gutter keeps selection rings inside overflow clip
                  // (overflow-x-hidden + ring-2 otherwise crops left/right edges).
                  'scrollbar-none flex h-full min-h-0 w-1/2 shrink-0 flex-col overflow-x-hidden overflow-y-auto px-1.5',
                  isSliding && 'pointer-events-none will-change-[opacity]',
                )}
                style={{
                  opacity: leftOpacity,
                  ...createPoolSlideMotionStyle('opacity', trackTransition),
                }}
              >
                {renderStepScrollContent(leftPanelStep)}
              </div>
              <div
                className={cn(
                  'scrollbar-none pointer-events-none flex h-full min-h-0 w-1/2 shrink-0 flex-col overflow-x-hidden overflow-y-auto px-1.5',
                  isSliding && 'will-change-[opacity]',
                )}
                style={{
                  opacity: rightOpacity,
                  ...createPoolSlideMotionStyle('opacity', trackTransition),
                }}
                aria-hidden={!rightPanelStep}
              >
                {rightPanelStep ? renderStepScrollContent(rightPanelStep) : null}
              </div>
            </div>
            )}
          </div>

          <footer
            className={cn(
              CREATE_POOL_FOOTER_CLASS,
              CREATE_POOL_FOOTER_DESKTOP_SLOT_CLASS,
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
                className={CREATE_POOL_BTN_PRIMARY_CLASS}
              >
                <Link
                  ref={goToPoolRef}
                  href={`/pool/${createdPool.inviteCode}`}
                >
                  Open Pool
                </Link>
              </Button>
            ) : null}
          </footer>
        </div>
      </div>

      <AlertDialog
        open={publicConfirmOpen}
        onOpenChange={(open) => {
          setPublicConfirmOpen(open)
          if (!open && !isPublic) {
            // Cancel / dismiss keeps toggle off (already false).
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make this pool public?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone will be able to see and join it from the Discover page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsPublic(false)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsPublic(true)
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

export default function CreatePoolPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-background">
          <p className="text-[#5a7080]">Loading…</p>
        </main>
      }
    >
      <CreatePoolPageInner />
    </Suspense>
  )
}
