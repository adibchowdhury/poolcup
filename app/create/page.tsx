'use client'

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { flushSync } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Download, Flag, ImagePlus, Loader2, Target, Trash2, Trophy, Zap } from 'lucide-react'
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
  type PoolCreationQuota,
} from '@/src/lib/pool-creation-limit'
import {
  formatSportingEventDateRange,
  formatSportingEventDateRangeCompact,
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
import { LockedCommissionerFeature } from '@/components/pool/locked-commissioner-feature'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { cn } from '@/lib/utils'
import { patchPoolSettings } from '@/src/lib/pool-settings-client'
import {
  DEFAULT_POOL_THEME_COLOR,
  normalizePoolThemeColor,
  POOL_THEME_COLOR_PRESETS,
  resolvePoolThemeColor,
} from '@/src/lib/pool-theme'
import {
  formatOfficialLeagueName,
  formatOfficialSeasonLabel,
} from '@/src/lib/fetch-official-pools'
import { uploadPoolEmblem } from '@/src/lib/upload-pool-emblem'

const CREATE_POOL_STEPS = [
  { id: 'competition' as const, label: 'Sport' },
  { id: 'type' as const, label: 'Pool Type' },
  { id: 'customize' as const, label: 'Customize' },
  { id: 'rules' as const, label: 'Rules' },
] as const

/** Stepper shows steps 1–4; success is post-create (outside the stepper). */
const STEPPER_STEP_COUNT = CREATE_POOL_STEPS.length
const SUCCESS_STEP = STEPPER_STEP_COUNT + 1
const TOTAL_FLOW_STEPS = SUCCESS_STEP

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
const STEPPER_WHITE = '#ffffff'

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
const CREATE_POOL_STEP_HEADING_DESKTOP_CLASS = cn(
  CREATE_POOL_STEP_HEADING_CLASS,
  'lg:text-3xl',
)

/** Pinned CTA row. Desktop keeps a tall slot; mobile hugs the button (no dead space). */
const CREATE_POOL_FOOTER_CLASS =
  'flex shrink-0 flex-col justify-end pt-4 max-lg:min-h-0 lg:min-h-[8.75rem]'

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
    <div className="flex w-full items-stretch gap-3 pb-1.5 pr-1.5 [-webkit-tap-highlight-color:transparent]">
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
          'max-lg:w-full',
          showBack ? 'min-w-0 flex-1' : 'w-full',
        )}
      >
        <Button
          type={continueType}
          size="lg"
          form={continueForm}
          className={CREATE_POOL_BTN_PRIMARY_CLASS}
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

/** Numbered circles only — labels would wrap on narrow mobile at four steps. */
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

function sportPillClass(selected: boolean) {
  return cn(
    CREATE_POOL_SELECTION_TILE_CLASS,
    'inline-flex items-center gap-2 rounded-full border bg-[#080b0f]/60 px-2.5 py-1.5 sm:px-3',
    selected
      ? 'border-2 border-primary ring-2 ring-primary/40'
      : 'border-[#1e2d3d] hover:border-primary/40',
  )
}

function formatCompetitionStatus(status: string): {
  label: string
  live: boolean
} {
  if (status === 'live') {
    return { label: 'Live', live: true }
  }
  return { label: 'Upcoming', live: false }
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

export default function CreatePoolPage() {
  const inviteQrCanvasRef = useRef<HTMLCanvasElement>(null)
  const goToPoolRef = useRef<HTMLAnchorElement>(null)
  const emblemInputRef = useRef<HTMLInputElement>(null)
  const draftLogoPreviewRef = useRef<string | null>(null)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

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
  const [poolName, setPoolName] = useState('')
  const [poolDescription, setPoolDescription] = useState('')
  const [scoringStyle, setScoringStyle] = useState<PoolScoringStyleId>('classic')
  const [isPublic, setIsPublic] = useState(false)
  const [publicConfirmOpen, setPublicConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creationQuota, setCreationQuota] = useState<PoolCreationQuota | null>(
    null,
  )
  const [nameError, setNameError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [createdPool, setCreatedPool] = useState<CreatedPool | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [draftThemeColor, setDraftThemeColor] = useState<string | null>(null)
  const [draftLogoFile, setDraftLogoFile] = useState<File | null>(null)
  const [draftLogoPreviewUrl, setDraftLogoPreviewUrl] = useState<string | null>(
    null,
  )
  const [emblemBusy, setEmblemBusy] = useState(false)
  const emblemFileInputId = 'create-pool-emblem-file'

  const hasCommissionerTools = creationQuota?.tier === 'commissioner'
  const effectiveDraftTheme = resolvePoolThemeColor(draftThemeColor)

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

  useEffect(() => {
    if (step !== 1) return
    void loadCreatableEvents()
  }, [step, loadCreatableEvents])

  useEffect(() => {
    return () => {
      if (draftLogoPreviewRef.current) {
        URL.revokeObjectURL(draftLogoPreviewRef.current)
        draftLogoPreviewRef.current = null
      }
    }
  }, [])

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
  const loadCreationQuota = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch('/api/pools/creation-quota')
      if (res.status === 401) {
        router.replace('/login?next=/create')
        return
      }
      if (!res.ok) return
      const data = (await res.json()) as {
        tier?: PoolCreationQuota['tier']
        ownedPoolCount?: number
        owned_pool_count?: number
      }
      const owned =
        typeof data.ownedPoolCount === 'number'
          ? data.ownedPoolCount
          : typeof data.owned_pool_count === 'number'
            ? data.owned_pool_count
            : 0
      const tier =
        data.tier === 'pro' || data.tier === 'commissioner' ? data.tier : 'free'
      setCreationQuota({
        tier,
        ownedPoolCount: owned,
        limit: null,
        canCreateMore: true,
      })
    } catch (err) {
      console.error('create: failed to load creation quota', err)
    }
  }, [user, router])

  useEffect(() => {
    if (authLoading || !user) return
    void loadCreationQuota()
  }, [authLoading, user, loadCreationQuota])

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
      goToStep(4, 1)
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
    return false
  }, [
    step,
    selectedSport,
    selectedEventId,
    eventsForSelectedSport,
    scoringStyle,
    poolName,
  ])

  async function applyDraftBrandingAfterCreate(poolId: string) {
    if (!hasCommissionerTools) return

    if (draftThemeColor !== null) {
      await patchPoolSettings(poolId, {
        themeColor: normalizePoolThemeColor(draftThemeColor),
      })
    }

    if (draftLogoFile) {
      const upload = await uploadPoolEmblem(supabase, poolId, draftLogoFile)
      if (upload.publicUrl) {
        await patchPoolSettings(poolId, { emblemUrl: upload.publicUrl })
      }
    }
  }

  function handleDraftEmblemFileChange(file: File | undefined) {
    if (!file || !hasCommissionerTools) return
    if (draftLogoPreviewRef.current) {
      URL.revokeObjectURL(draftLogoPreviewRef.current)
    }
    const previewUrl = URL.createObjectURL(file)
    draftLogoPreviewRef.current = previewUrl
    setDraftLogoFile(file)
    setDraftLogoPreviewUrl(previewUrl)
  }

  function handleRemoveDraftEmblem() {
    if (draftLogoPreviewRef.current) {
      URL.revokeObjectURL(draftLogoPreviewRef.current)
      draftLogoPreviewRef.current = null
    }
    setDraftLogoFile(null)
    setDraftLogoPreviewUrl(null)
    if (emblemInputRef.current) emblemInputRef.current.value = ''
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

    setSubmitting(false)
    setLoadingMessage(null)
    setCreatedPool({
      id: pool.id,
      name: trimmedName,
      inviteCode: pool.invite_code,
    })
    capturePostHog('pool_created', {
      pool_id: pool.id,
      sport: normalizeSportKey(selectedEvent.sport),
      is_public: Boolean(pool.is_public),
    })
    void loadCreationQuota()
    void applyDraftBrandingAfterCreate(pool.id)
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
            <dt className="text-[#5a7080]">Branding</dt>
            <dd className="text-right font-medium text-[#f0f4f8]">
              {hasCommissionerTools
                ? draftLogoPreviewUrl
                  ? 'Custom logo'
                  : draftThemeColor
                    ? effectiveDraftTheme
                    : 'Default'
                : 'Default (Commissioner to customize)'}
            </dd>
          </div>
        </dl>
      </div>
    )
  }

  function renderStepScrollContent(panelStep: number) {
    return (
      <>
          {panelStep === 1 && (
            <>
              <h2 className={CREATE_POOL_STEP_HEADING_CLASS}>
                Choose Sport
              </h2>
              <p className="mt-1.5 text-sm text-[#5a7080]">
                Pick the sport your pool will follow.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => handleSportSelect(sport.id)}
                    className={cn(
                      sportPillClass(selectedSport === sport.id),
                      'cursor-pointer text-[#f0f4f8]',
                    )}
                  >
                    <Image
                      src={sport.imageSrc}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                    />
                    <span className="text-xs font-medium sm:text-sm">
                      {sport.label}
                    </span>
                  </button>
                ))}
              </div>

              <h1 className={cn('mt-6', CREATE_POOL_STEP_HEADING_DESKTOP_CLASS)}>
                Choose a competition
              </h1>
              <p className="mt-2 text-sm text-[#5a7080]">
                Select the league or event your pool will follow.
              </p>

              <div className="mt-6 space-y-2">
                {!selectedSport ? (
                  <div className="rounded-xl border border-[#1e2d3d]/60 bg-[#080b0f]/40 px-4 py-10 text-center">
                    <p className="text-sm text-[#5a7080]">
                      Pick a sport above to browse available competitions.
                    </p>
                  </div>
                ) : eventsLoading ? (
                  <div className="rounded-xl border border-[#1e2d3d]/60 bg-[#080b0f]/60 px-4 py-10 text-center">
                    <p className="text-sm text-[#5a7080]">Loading competitions…</p>
                  </div>
                ) : eventsError ? (
                  <div className="rounded-xl border border-[#1e2d3d]/60 bg-[#080b0f]/60 px-4 py-8 text-center">
                    <p className="text-sm text-red-400">{eventsError}</p>
                    <button
                      type="button"
                      onClick={() => void loadCreatableEvents()}
                      className={cn(
                        'mt-4 rounded-lg border border-[#1e2d3d] px-4 py-2 text-sm text-[#f0f4f8] hover:border-primary/50',
                        FOCUS_RING_CLASS,
                      )}
                    >
                      Try again
                    </button>
                  </div>
                ) : eventsForSelectedSport.length === 0 ? (
                  <div className="rounded-xl border border-[#1e2d3d]/60 bg-[#080b0f]/60 px-4 py-10 text-center opacity-60">
                    <p className="text-sm text-[#5a7080]">
                      No active {formatSportLabel(selectedSport)} competitions
                      right now — check back soon.
                    </p>
                  </div>
                ) : (
                  eventsForSelectedSport.map((event) => {
                    const selected = selectedEventId === event.id
                    const status = formatCompetitionStatus(event.status)
                    const { leagueName, seasonLabel } =
                      formatCreateFlowCompetitionDisplay(event)
                    const dateRange = formatSportingEventDateRangeCompact(
                      event.start_date,
                      event.end_date,
                    )
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => handleEventSelect(event.id)}
                        className={cn(
                          'flex w-full min-h-12 items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-all sm:gap-3 sm:px-4 lg:min-h-0 lg:py-3',
                          selectionTileClass(selected),
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#f0f4f8] sm:text-base">
                            {leagueName}
                            {seasonLabel ? (
                              <>
                                <span className="text-[#5a7080]"> · </span>
                                <span className="font-normal text-[#5a7080]">
                                  {seasonLabel}
                                </span>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                          <span className="whitespace-nowrap text-[11px] tabular-nums text-[#5a7080] sm:text-xs">
                            {dateRange}
                          </span>
                          <span
                            className={cn(
                              'whitespace-nowrap text-[11px] font-medium sm:text-xs',
                              status.live
                                ? 'text-red-500'
                                : 'text-[#5a7080]',
                            )}
                          >
                            <span aria-hidden>● </span>
                            {status.label}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </>
          )}

          {panelStep === 2 && (
            <>
              <h1 className={CREATE_POOL_STEP_HEADING_DESKTOP_CLASS}>
                Choose Pool Type
              </h1>
              <p className="mt-2 text-sm text-[#5a7080]">
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
              <h1 className={CREATE_POOL_STEP_HEADING_DESKTOP_CLASS}>
                Customize Your Pool
              </h1>
              <p className="mt-2 text-sm text-[#5a7080]">
                Name, privacy, and branding — logo and theme are optional.
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

                {!hasCommissionerTools ? (
                  <div className="space-y-4">
                    <LockedCommissionerFeature
                      title="Pool logo"
                      description="Upload a custom emblem for your pool"
                      isOwner
                    />
                    <LockedCommissionerFeature
                      title="Pool color"
                      description="Theme color for headers and accents"
                      isOwner
                    />
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <span className="block text-xs font-medium uppercase tracking-wider text-[#5a7080]">
                        Pool logo
                      </span>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        {draftLogoPreviewUrl ? (
                          <div className="relative mx-auto h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-[#1e2d3d] sm:mx-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={draftLogoPreviewUrl}
                              alt="Pool logo preview"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <PoolAvatarImage
                            avatar={null}
                            emblemUrl={null}
                            size="md"
                            className="mx-auto sm:mx-0"
                          />
                        )}
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-xs text-[#5a7080]">
                            {draftLogoPreviewUrl
                              ? 'Shown in the pool header and on share cards.'
                              : 'Add a pool logo to personalize this squad.'}
                          </p>
                          <input
                            ref={emblemInputRef}
                            id={emblemFileInputId}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            disabled={emblemBusy}
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              handleDraftEmblemFileChange(file)
                            }}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={cn('h-9', FOCUS_RING_CLASS)}
                              disabled={emblemBusy}
                              aria-controls={emblemFileInputId}
                              onClick={() => emblemInputRef.current?.click()}
                            >
                              {emblemBusy ? (
                                <>
                                  <Loader2
                                    className="mr-2 h-4 w-4 animate-spin"
                                    aria-hidden
                                  />
                                  Uploading…
                                </>
                              ) : (
                                <>
                                  <ImagePlus
                                    className="mr-2 h-4 w-4"
                                    aria-hidden
                                  />
                                  {draftLogoPreviewUrl
                                    ? 'Replace logo'
                                    : 'Add a pool logo'}
                                </>
                              )}
                            </Button>
                            {draftLogoPreviewUrl ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  'h-9 text-red-400 hover:text-red-400',
                                  FOCUS_RING_CLASS,
                                )}
                                disabled={emblemBusy}
                                onClick={handleRemoveDraftEmblem}
                              >
                                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                                Remove
                              </Button>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-[#5a7080]">
                            JPEG, PNG, or WebP. Applied when your pool is
                            created.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="block text-xs font-medium uppercase tracking-wider text-[#5a7080]">
                        Pool color
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <div
                          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border-2 border-white/25"
                          style={{
                            background: `linear-gradient(160deg, ${effectiveDraftTheme} 0%, color-mix(in srgb, ${effectiveDraftTheme} 50%, #0a0a0a) 100%)`,
                          }}
                          aria-label={`Current pool color ${effectiveDraftTheme}`}
                        />
                        <p className="min-w-0 flex-1 font-mono text-sm text-[#5a7080]">
                          {effectiveDraftTheme}
                          {draftThemeColor == null ? ' · default' : ''}
                        </p>
                      </div>
                      <div
                        className="flex flex-wrap gap-2.5"
                        role="group"
                        aria-label="Theme color presets"
                      >
                        <button
                          type="button"
                          onClick={() => setDraftThemeColor(null)}
                          className={cn(
                            'relative h-11 min-w-[4.5rem] overflow-hidden rounded-xl border px-3 text-xs font-semibold transition-all',
                            FOCUS_RING_CLASS,
                            draftThemeColor == null
                              ? 'scale-[1.03] border-2 border-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_40%,transparent)]'
                              : 'border border-white/15 hover:scale-[1.03]',
                          )}
                          style={{
                            background: `linear-gradient(160deg, ${DEFAULT_POOL_THEME_COLOR} 0%, color-mix(in srgb, ${DEFAULT_POOL_THEME_COLOR} 55%, #111) 100%)`,
                          }}
                        >
                          <span className="relative z-10 text-[#080b0f] drop-shadow-sm">
                            Default
                          </span>
                          {draftThemeColor == null ? (
                            <Check
                              className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-[#080b0f]"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                        {POOL_THEME_COLOR_PRESETS.map((preset) => {
                          const selected =
                            normalizePoolThemeColor(draftThemeColor) ===
                            preset.hex
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setDraftThemeColor(preset.hex)}
                              className={cn(
                                'relative h-11 w-11 overflow-hidden rounded-xl border transition-all',
                                FOCUS_RING_CLASS,
                                selected
                                  ? 'scale-[1.03] border-2 border-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_40%,transparent)]'
                                  : 'border border-white/15 hover:scale-[1.03]',
                              )}
                              style={{
                                background: `linear-gradient(160deg, ${preset.hex} 0%, color-mix(in srgb, ${preset.hex} 55%, #111) 100%)`,
                              }}
                              title={preset.label}
                              aria-label={preset.label}
                            >
                              {selected ? (
                                <Check
                                  className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow"
                                  aria-hidden
                                />
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {panelStep === 4 && (
            <>
              <h1 className={CREATE_POOL_STEP_HEADING_DESKTOP_CLASS}>
                Rules &amp; Create
              </h1>
              <p className="mt-2 text-sm text-[#5a7080]">
                Review your choices and confirm scoring rules before creating
                your pool.
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
                Predictions lock when each match kicks off. After creation you
                can adjust advanced scoring and commissioner tools in pool
                settings.
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
              <h1 className="font-display text-3xl tracking-wide text-[#f0f4f8]">
                Pool Created! 🎉
              </h1>
              <p className="mt-2 text-sm text-[#5a7080]">
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

  return (
    <main className="min-h-dvh bg-background lg:flex lg:min-h-screen lg:items-center lg:justify-center lg:px-4 lg:py-10">
      <div className={cn('flex min-h-0 w-full flex-col', CREATE_POOL_SHELL_WIDTH_CLASS)}>
        <div className={CREATE_POOL_CARD_CLASS}>
          <header className="shrink-0 space-y-3 lg:space-y-4">
            {step < SUCCESS_STEP ? (
              <div className="space-y-2 lg:space-y-0">
                <div className="relative flex min-h-11 items-center lg:hidden">
                  {step === 1 ? (
                    <Link
                      href="/dashboard"
                      className={cn(
                        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-muted-foreground transition-colors hover:text-foreground',
                        FOCUS_RING_CLASS,
                      )}
                      aria-label="Back to dashboard"
                    >
                      ←
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goToStep(step - 1, -1)}
                      disabled={navLocked}
                      className={cn(
                        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50',
                        FOCUS_RING_CLASS,
                      )}
                      aria-label="Back to previous step"
                    >
                      ←
                    </button>
                  )}
                  <p className="pointer-events-none absolute inset-x-0 text-center text-sm font-semibold text-[#f0f4f8]">
                    {CREATE_POOL_STEPS[step - 1]?.label}
                  </p>
                  <span
                    className="relative z-10 ml-auto flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground"
                    aria-hidden
                  >
                    <Flag className="h-4 w-4" />
                  </span>
                </div>
                <div className="relative flex min-h-11 items-center justify-center">
                  {step === 1 ? (
                    <Link
                      href="/dashboard"
                      className={cn(
                        'absolute left-0 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-xl leading-none text-muted-foreground transition-colors hover:text-foreground lg:flex',
                        FOCUS_RING_CLASS,
                      )}
                      aria-label="Back to dashboard"
                    >
                      ←
                    </Link>
                  ) : null}
                  <CreatePoolStepper currentStep={step} />
                </div>
              </div>
            ) : null}
          </header>

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
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
          </div>

          <footer className={CREATE_POOL_FOOTER_CLASS}>
            {step === 1 ? (
              <CreatePoolNavFooter
                showBack={false}
                continueLabel="Continue"
                continueDisabled={!canContinueStep || navLocked}
                onContinue={handleContinueFromStep}
              />
            ) : null}

            {step === 2 ? (
              <CreatePoolNavFooter
                showBack
                backDisabled={navLocked}
                onBack={() => goToStep(1, -1)}
                continueLabel="Continue"
                continueDisabled={!canContinueStep || navLocked}
                onContinue={handleContinueFromStep}
              />
            ) : null}

            {step === 3 ? (
              <CreatePoolNavFooter
                showBack
                backDisabled={navLocked}
                onBack={() => goToStep(2, -1)}
                continueLabel="Continue"
                continueDisabled={!canContinueStep || navLocked}
                onContinue={handleContinueFromStep}
              />
            ) : null}

            {step === 4 ? (
              <CreatePoolNavFooter
                showBack
                backDisabled={navLocked}
                onBack={() => goToStep(3, -1)}
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

            {step === SUCCESS_STEP && createdPool ? (
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
