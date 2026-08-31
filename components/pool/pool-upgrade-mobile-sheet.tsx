'use client'

import Image from 'next/image'
import { useEffect, useState, type CSSProperties } from 'react'
import {
  Download,
  Loader2,
  Palette,
  Target,
  UserCog,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PoolUpgradePriceCard } from '@/components/pool/pool-upgrade-price-card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { startCustomPoolCheckout } from '@/src/lib/custom-pool-checkout-client'
import { cn } from '@/lib/utils'
import { POOL_DESKTOP_CANVAS_CLASS } from '@/src/lib/dashboard-surfaces'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'

/** Mobile upgrade hero — 1536×1024 asset. */
export const UPGRADE_CROWN_MOBILE_SRC = '/upgrade_page_assets/crown_mobile.png'
/**
 * Crown size — was 12.5rem (~200×133).
 * Now 14rem (~224×149) at tall viewports.
 * Short (≤720px tall): max-h 16dvh so no-scroll holds with 5th feature.
 * Shift down: stack top was pt-3 (12px); now pt-5 (20px) → +8px (@844).
 */
const CROWN_DISPLAY_CLASS =
  'h-auto w-[14rem] max-w-full object-contain [@media(max-height:720px)]:max-h-[16dvh]'
/**
 * Crown → title gap — was mt-3 (12px); now mt-5 (20px).
 * Short: compresses to mt-3.
 */
const CROWN_TO_TITLE_GAP_CLASS =
  'mt-5 [@media(max-height:720px)]:mt-3'

/**
 * Stack top / bottom inset — top was pt-3; now pt-5 (crown sits lower).
 * Short: top compresses to pt-3. Bottom stays pb-3.
 */
const STACK_TOP_PAD_CLASS = 'pt-5 [@media(max-height:720px)]:pt-3'
const STACK_BOTTOM_PAD_CLASS = 'pb-3'

/**
 * Title → features gap — fixed mt-3 (12px).
 */
const TITLE_TO_FEATURES_GAP_CLASS = 'mt-3'

/**
 * Features → price card — preferred 24px; flex-shrinks toward 0 on short screens.
 */
const FEATURES_TO_CARD_SPACER_CLASS = 'min-h-0 flex-1 basis-6'

/**
 * Card → bottom cluster — absorbs leftover height on tall; compresses to 0 on short.
 */
const CARD_TO_CTA_SPACER_CLASS = 'min-h-0 flex-[1.4]'

/**
 * Purchase unit width — card + CTA share this exact max (19rem / 304px).
 */
const PURCHASE_UNIT_WIDTH_CLASS = 'mx-auto w-full max-w-[19rem]'

/**
 * Mobile card vertical padding (benefits row off).
 * Short: py-4 to reclaim height after fifth feature + bigger crown.
 */
const MOBILE_PRICE_CARD_PAD_CLASS =
  'py-5 [@media(max-height:720px)]:py-4'

/**
 * CTA height — h-10 (40px). Width locked to purchase unit.
 */
const CTA_HEIGHT_CLASS = 'h-10'

/** Feature row gap — short: gap-1.5. */
const FEATURE_LIST_GAP_CLASS =
  'gap-2 [@media(max-height:720px)]:gap-1.5'

/**
 * Bottom cluster gaps (reassurance / CTA / pipe) — was gap-2 (8px);
 * now gap-4 (16px). On short viewports (max-height 720px) compresses to 10px.
 */
const BOTTOM_CLUSTER_GAP_CLASS =
  'gap-4 [@media(max-height:720px)]:gap-2.5'

/**
 * Login subtitle grey — `Your picks are waiting` uses `text-[#96A29D]`
 * (app/login/page.tsx). Used for trust / reassurance.
 */
const LOGIN_SUBTITLE_MUTED = '#96A29D'

/**
 * Feature list grey — brighter than login muted so features pop
 * (#96A29D → #CFD4D1, mid #C9CFCC–#D5DAD7 band).
 */
const FEATURE_LIST_GREY = '#CFD4D1'

/**
 * Top-centered atmospheric glow.
 */
export const POOL_UPGRADE_MOBILE_HERO_GLOW_CLASS =
  'pointer-events-none absolute inset-x-0 top-0 h-[min(32rem,58%)] bg-[radial-gradient(ellipse_95%_78%_at_50%_0%,rgba(0,230,118,0.24),rgba(0,230,118,0.10)_42%,transparent_72%)]'

/** Classic four-point star-glint — same path as desktop upgrade hero. */
const SPARKLE_PATH =
  'M12 0 L14.4 9.6 L24 12 L14.4 14.4 L12 24 L9.6 14.4 L0 12 L9.6 9.6 Z'

type SparkleSpec = {
  size: number
  top: string
  left: string
  rotate: number
  opacity?: number
}

/**
 * Wider title-zone scatter — relative to the title wrapper.
 */
const MOBILE_TITLE_SPARKLE_SPECS: SparkleSpec[] = [
  { size: 10, top: '-22%', left: '-28%', rotate: 18, opacity: 0.66 },
  { size: 18, top: '4%', left: '108%', rotate: -24, opacity: 0.82 },
  { size: 8, top: '48%', left: '-34%', rotate: 36, opacity: 0.5 },
  { size: 14, top: '-12%', left: '96%', rotate: -8, opacity: 0.7 },
  { size: 20, top: '58%', left: '-18%', rotate: 12, opacity: 0.76 },
  { size: 9, top: '88%', left: '102%', rotate: -32, opacity: 0.54 },
]

function UpgradeMobileTitleSparkles() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden
    >
      {MOBILE_TITLE_SPARKLE_SPECS.map((sparkle, index) => (
        <svg
          key={index}
          viewBox="0 0 24 24"
          width={sparkle.size}
          height={sparkle.size}
          className="absolute drop-shadow-[0_0_10px_rgba(0,230,118,0.45)]"
          style={{
            top: sparkle.top,
            left: sparkle.left,
            transform: `rotate(${sparkle.rotate}deg)`,
            opacity: sparkle.opacity ?? 0.75,
          }}
        >
          <path d={SPARKLE_PATH} fill="#00e676" />
        </svg>
      ))}
    </div>
  )
}

/**
 * Mobile feature list — retitled/reordered.
 * Member Management reuses co-commissioner UserCog glyph.
 * Prediction Tracking = gated missing-predictions (UserX) — inserted above Export.
 */
const MOBILE_UPGRADE_FEATURES: ReadonlyArray<{
  id: string
  icon: LucideIcon
  name: string
}> = [
  { id: 'branding', icon: Palette, name: 'Pool Branding' },
  { id: 'member_management', icon: UserCog, name: 'Member Management' },
  { id: 'scoring', icon: Target, name: 'Custom Scoring' },
  {
    id: 'missing_predictions',
    icon: UserX,
    name: 'Prediction Tracking',
  },
  { id: 'exports', icon: Download, name: 'Export Results' },
]

const UPGRADE_FEATURE_GLYPH_CLASS = 'h-6 w-6 shrink-0'

const UPGRADE_CTA_WHITE_SURFACE = '#ffffff'

/**
 * Close X — walked back from h-11/size-6/#4a4a4a.
 * Landed: 32px disc (h-8 w-8), size-4 icon, darker #2a2a2a.
 */
const UPGRADE_CLOSE_BUTTON_CLASS =
  'left-4 right-auto top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2a2a] opacity-100 hover:bg-[#353535] hover:opacity-100 data-[state=open]:bg-[#2a2a2a]'
const UPGRADE_CLOSE_ICON_CLASS = 'size-4 text-white'

export type PoolUpgradeMobileSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  inviteCode: string
  poolId?: string
  isOwner: boolean
  poolHasCommissionerTools: boolean
}

/**
 * Full-screen mobile upgrade sheet — vertical purchase stack only.
 * Desktop uses `/pool/{invite}/upgrade` page (PoolUpgradeDesktopView).
 *
 * No scroll: h-[100dvh] + overflow-hidden; flex spacers compress on short viewports.
 * Stack: crown → title → features → price card → reassurance → CTA → trust.
 */
export function PoolUpgradeMobileSheet({
  open,
  onOpenChange,
  inviteCode,
  poolId,
  isOwner,
  poolHasCommissionerTools,
}: PoolUpgradeMobileSheetProps) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || poolHasCommissionerTools) return
    capturePostHog('upgrade_page_viewed', {
      pool_id: poolId ?? null,
      already_custom: poolHasCommissionerTools,
      surface: 'mobile_sheet',
    })
  }, [open, poolHasCommissionerTools, poolId, inviteCode])

  async function handleCheckout() {
    if (!poolId || busy || poolHasCommissionerTools) return
    setBusy(true)
    capturePostHog('upgrade_page_cta_clicked', {
      pool_id: poolId,
      surface: 'mobile_sheet',
    })
    const result = await startCustomPoolCheckout(poolId)
    if (!result.ok) {
      toast.error(result.error)
      setBusy(false)
      return
    }
    window.location.href = result.url
  }

  if (poolHasCommissionerTools) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="z-[110]"
        closeButtonClassName={UPGRADE_CLOSE_BUTTON_CLASS}
        closeIconClassName={UPGRADE_CLOSE_ICON_CLASS}
        className={cn(
          'left-0 inset-0 z-[110] h-[100dvh] max-h-[100dvh] w-full max-w-none gap-0 overflow-hidden border-0 p-0',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          POOL_DESKTOP_CANVAS_CLASS,
        )}
        aria-describedby={undefined}
      >
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
          <div
            className={POOL_UPGRADE_MOBILE_HERO_GLOW_CLASS}
            aria-hidden
          />
          {/*
            No-scroll distribution: h-full + overflow-hidden.
            Compressible spacers (min-h-0 flex-*) absorb leftover height on
            tall phones and collapse toward 0 on short — never overflow-y.
          */}
          <div
            className={cn(
              'mx-auto flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden px-4',
              STACK_TOP_PAD_CLASS,
              STACK_BOTTOM_PAD_CLASS,
            )}
          >
            {/* Zone 1 — crown + title */}
            <div className="flex w-full shrink-0 flex-col items-center">
              <Image
                src={UPGRADE_CROWN_MOBILE_SRC}
                alt=""
                width={224}
                height={149}
                className={CROWN_DISPLAY_CLASS}
                priority
              />
              <div
                className={cn(
                  'relative w-full max-w-[20rem] px-2',
                  CROWN_TO_TITLE_GAP_CLASS,
                )}
              >
                <UpgradeMobileTitleSparkles />
                {/*
                  Title break: two block + whitespace-nowrap spans.
                  Copy: "Get Unlimited Access to" / "Premium Features".
                */}
                <h1 className="relative text-center font-display text-[2.125rem] leading-[1.05] tracking-wide text-white sm:text-5xl">
                  <span className="block whitespace-nowrap">
                    Get Unlimited Access to
                  </span>
                  <span className="block whitespace-nowrap text-primary">
                    Premium Features
                  </span>
                </h1>
              </div>
            </div>

            {/* Zone 2 — features (closer under title via fixed mt-3) */}
            <ul
              className={cn(
                'mx-auto flex w-fit shrink-0 flex-col',
                FEATURE_LIST_GAP_CLASS,
                TITLE_TO_FEATURES_GAP_CLASS,
              )}
              aria-label="Premium features"
            >
              {MOBILE_UPGRADE_FEATURES.map((feature, index) => {
                const Icon = feature.icon
                const isLast = index === MOBILE_UPGRADE_FEATURES.length - 1
                return (
                  <li key={feature.id} className="flex items-center gap-2.5">
                    <Icon
                      className={UPGRADE_FEATURE_GLYPH_CLASS}
                      strokeWidth={2}
                      aria-hidden
                      style={{ color: FEATURE_LIST_GREY }}
                    />
                    <p
                      className="font-display text-base font-semibold leading-snug tracking-wide"
                      style={{ color: FEATURE_LIST_GREY }}
                    >
                      {feature.name}
                      {isLast ? (
                        <span className="font-display text-base font-semibold tracking-wide">
                          {'  '}+ much more!
                        </span>
                      ) : null}
                    </p>
                  </li>
                )
              })}
            </ul>

            <div className={FEATURES_TO_CARD_SPACER_CLASS} aria-hidden />

            {/* Zone 3 — shared card (purchase unit width) */}
            <section
              className={cn('w-full shrink-0', PURCHASE_UNIT_WIDTH_CLASS)}
              aria-label="Custom Pool purchase"
            >
              <PoolUpgradePriceCard
                showBenefitsRow={false}
                className={MOBILE_PRICE_CARD_PAD_CLASS}
              />
            </section>

            <div className={CARD_TO_CTA_SPACER_CLASS} aria-hidden />

            {/* Zone 4 — reassurance → CTA → trust (CTA width = card width) */}
            <div
              className={cn(
                'flex w-full shrink-0 flex-col items-center',
                BOTTOM_CLUSTER_GAP_CLASS,
                PURCHASE_UNIT_WIDTH_CLASS,
              )}
            >
              <p
                className="text-center font-sans text-xs leading-relaxed"
                style={{ color: LOGIN_SUBTITLE_MUTED }}
              >
                You&apos;ll keep all your current members and pool data.
              </p>

              {isOwner && poolId ? (
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void handleCheckout()}
                  className={cn(
                    CTA_HEIGHT_CLASS,
                    'w-full rounded-full border-none text-base font-semibold text-[#080b0f]',
                    'bg-white hover:bg-[#f8f9fa] active:bg-white',
                    '[background-image:none]',
                    FOCUS_VISIBLE_RING,
                  )}
                  style={
                    {
                      '--tactile-btn-surface': UPGRADE_CTA_WHITE_SURFACE,
                      background: '#ffffff',
                    } as CSSProperties
                  }
                >
                  {busy ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden
                      />
                      Starting checkout…
                    </>
                  ) : (
                    'Upgrade My Pool Experience'
                  )}
                </Button>
              ) : (
                <p
                  className="w-full rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm"
                  style={{ color: LOGIN_SUBTITLE_MUTED }}
                >
                  Only the pool owner can purchase Custom Pool for this squad.
                </p>
              )}

              <p
                className="w-full text-center font-sans text-[11px] leading-relaxed sm:text-xs"
                style={{ color: LOGIN_SUBTITLE_MUTED }}
              >
                One-time payment&nbsp;|&nbsp;No subscription&nbsp;|&nbsp;No
                hidden fees
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
