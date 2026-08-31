'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowLeft, Crown, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CUSTOM_POOL_UNLOCK_FEATURES } from '@/src/lib/custom-pool-unlock-features'
import { startCustomPoolCheckout } from '@/src/lib/custom-pool-checkout-client'
import { cn } from '@/lib/utils'
import { POOL_DESKTOP_CANVAS_CLASS } from '@/src/lib/dashboard-surfaces'
import { POOL_DESKTOP_CONTENT_RAIL_CLASS } from '@/components/pool/pool-desktop-top-bar'
import { PoolUpgradePriceCard } from '@/components/pool/pool-upgrade-price-card'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'

/** FAQ lives on /pricing (no dedicated /faq route). */
export const POOL_UPGRADE_FAQ_HREF = '/pricing#faq-heading'

/** Login-gradient family — subtle green atmospheric glow behind hero/purchase. */
export const POOL_UPGRADE_HERO_GLOW_CLASS =
  'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_42%_18%,rgba(0,230,118,0.14),transparent_52%),radial-gradient(ellipse_at_78%_72%,rgba(0,230,118,0.05),transparent_48%)]'

const UPGRADE_CROWN_SRC = '/upgrade_page_assets/crown.png'

/** Combined upgrade composition — purchase column + feature panel. */
export const POOL_UPGRADE_COMPOSITION_MAX_W = 1120

/** Crown hero — enlarged for hero prominence (was 260px). */
const CROWN_DISPLAY_PX = 300

/** Portrait checkout card — purchase column width constraint. */
export const POOL_UPGRADE_CHECKOUT_CARD_W = 576

const POOL_UPGRADE_FEATURES_SURFACE_CLASS =
  'rounded-2xl bg-[#111111] shadow-[0_12px_40px_rgba(0,0,0,0.34)]'

/** Subtext max-width — ~1.2× title measure (~17.5rem), still ≤2 lines. */
const UPGRADE_SUBTEXT_MAX_W = '21rem'

/** Feature description — narrow enough to wrap to a second line. */
const UPGRADE_FEATURE_DESC_MAX_W = '10.75rem'

const UPGRADE_FEATURE_ICON_PX = 38

const UPGRADE_CTA_WHITE_SURFACE = '#ffffff'

/** Classic four-point star-glint silhouette (elongated tips on cardinal axes). */
const SPARKLE_PATH =
  'M12 0 L14.4 9.6 L24 12 L14.4 14.4 L12 24 L9.6 14.4 L0 12 L9.6 9.6 Z'

type SparkleSpec = {
  size: number
  top: string
  left: string
  rotate: number
  opacity?: number
}

/** Re-anchored — hero row centers text against 300px crown. */
const HERO_SPARKLE_SPECS: SparkleSpec[] = [
  { size: 12, top: '4%', left: '-2%', rotate: 14, opacity: 0.75 },
  { size: 22, top: '0%', left: '30%', rotate: -18, opacity: 0.9 },
  { size: 10, top: '12%', left: '58%', rotate: 38, opacity: 0.6 },
  { size: 26, top: '52%', left: '-4%', rotate: -12, opacity: 0.85 },
  { size: 14, top: '26%', left: '46%', rotate: 24, opacity: 0.7 },
  { size: 20, top: '6%', left: '84%', rotate: -28, opacity: 0.8 },
  { size: 10, top: '44%', left: '74%', rotate: 6, opacity: 0.55 },
]

function UpgradeHeroSparkles() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden
    >
      {HERO_SPARKLE_SPECS.map((sparkle, index) => (
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

export type PoolUpgradeDesktopViewProps = {
  inviteCode: string
  poolId?: string
  poolName: string
  isOwner: boolean
  poolHasCommissionerTools: boolean
  onBackToSettings: () => void
  className?: string
}

export function PoolUpgradeDesktopView({
  inviteCode,
  poolId,
  poolName,
  isOwner,
  poolHasCommissionerTools,
  onBackToSettings,
  className,
}: PoolUpgradeDesktopViewProps) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    capturePostHog('upgrade_page_viewed', {
      pool_id: poolId ?? null,
      already_custom: poolHasCommissionerTools,
    })
  }, [poolHasCommissionerTools, poolId, inviteCode])

  async function handleCheckout() {
    if (!poolId || busy || poolHasCommissionerTools) return
    setBusy(true)
    capturePostHog('upgrade_page_cta_clicked', { pool_id: poolId })
    const result = await startCustomPoolCheckout(poolId)
    if (!result.ok) {
      toast.error(result.error)
      setBusy(false)
      return
    }
    window.location.href = result.url
  }

  return (
    <div
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto',
        POOL_DESKTOP_CANVAS_CLASS,
        className,
      )}
    >
      <div className={POOL_UPGRADE_HERO_GLOW_CLASS} aria-hidden />

      {/* Minimal transparent chrome — back link + FAQ pill only */}
      <header
        className={cn(
          'sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between gap-4 bg-transparent',
          POOL_DESKTOP_CONTENT_RAIL_CLASS,
        )}
      >
        <button
          type="button"
          onClick={onBackToSettings}
          className={cn(
            'inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
            FOCUS_VISIBLE_RING,
            'rounded-md',
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to Pool Settings
        </button>
        <Link
          href={POOL_UPGRADE_FAQ_HREF}
          className={cn(
            'inline-flex shrink-0 items-center rounded-full border border-[#292929] bg-[#171717] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1f1f1f]',
            FOCUS_VISIBLE_RING,
          )}
        >
          I have a question
        </Link>
      </header>

      <div
        className={cn(
          'relative z-10 flex w-full flex-1 flex-col items-center justify-start pb-6 lg:pt-6',
          POOL_DESKTOP_CONTENT_RAIL_CLASS,
        )}
      >
        {poolHasCommissionerTools ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-[#141414] px-8 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
              <Crown className="h-7 w-7 text-primary" aria-hidden />
            </div>
            <h1 className="font-display text-3xl tracking-wide text-foreground">
              Already a Custom Pool
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/90">{poolName}</span>{' '}
              already has Custom Pool features unlocked — permanently, for this
              pool.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={onBackToSettings}
              className={cn('mt-2', FOCUS_VISIBLE_RING)}
            >
              Back to Pool Settings
            </Button>
          </div>
        ) : (
          <div
            className="mx-auto grid w-full min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-stretch lg:gap-3"
            style={{ maxWidth: POOL_UPGRADE_COMPOSITION_MAX_W }}
          >
            {/* Purchase column — hero, pricing, CTA as one tight stack */}
            <div className="flex min-h-0 min-w-0 flex-col lg:pt-4">
              <div className="relative">
                <UpgradeHeroSparkles />
                <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                  <div
                    className="pool-upgrade-crown-wrap relative mx-auto shrink-0 sm:mx-0"
                    style={{
                      width: CROWN_DISPLAY_PX,
                      height: CROWN_DISPLAY_PX,
                    }}
                  >
                    <div className="pool-upgrade-crown-float">
                      <div className="pool-upgrade-crown-tilt">
                        <Image
                          src={UPGRADE_CROWN_SRC}
                          alt=""
                          width={CROWN_DISPLAY_PX}
                          height={CROWN_DISPLAY_PX}
                          className="h-full w-full object-contain"
                          priority
                        />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h1 className="font-display text-5xl leading-[0.95] tracking-wide text-foreground lg:text-[3rem]">
                      Upgrade Your Pool
                    </h1>
                    <p
                      className="mx-auto mt-2.5 font-sans text-sm leading-snug text-muted-foreground sm:mx-0"
                      style={{ maxWidth: UPGRADE_SUBTEXT_MAX_W }}
                    >
                      Unlock powerful commissioner tools and more control over
                      your pool. Pay once and keep Custom Pool features
                      forever.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="mx-auto -mt-3 flex w-full flex-col"
                style={{
                  maxWidth: POOL_UPGRADE_CHECKOUT_CARD_W,
                }}
              >
                <section
                  className="w-full min-w-0"
                  aria-label="Custom Pool purchase"
                >
                  <PoolUpgradePriceCard />
                </section>

                <p className="my-4 flex items-center justify-center gap-1.5 font-sans text-xs text-muted-foreground">
                  <ShieldCheck
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                    strokeWidth={2}
                    aria-hidden
                  />
                  Secure one-time payment. No hidden fees.
                </p>

                {isOwner && poolId ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void handleCheckout()}
                    className={cn(
                      'h-12 w-full rounded-md border-none text-base font-semibold text-[#080b0f]',
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
                      'Upgrade My Pool for $9.99'
                    )}
                  </Button>
                ) : (
                  <p className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    Only the pool owner can purchase Custom Pool for this squad.
                  </p>
                )}

                <p className="mt-5 text-center font-sans text-xs leading-relaxed text-muted-foreground">
                  You&apos;ll keep all your current members, predictions,
                  standings, and pool data.
                </p>
              </div>
            </div>

            {/* Feature panel — stretches to match purchase column height */}
            <aside
              className={cn(
                'flex min-h-0 min-w-0 flex-col p-5 lg:sticky lg:top-[4.5rem] lg:pt-4 lg:self-stretch',
                POOL_UPGRADE_FEATURES_SURFACE_CLASS,
              )}
              aria-label="What you'll unlock"
            >
              <h2 className="shrink-0 text-center font-display text-2xl font-semibold uppercase tracking-wide text-white">
                What You&apos;ll Unlock
              </h2>
              {/*
                Feature list flexes into equal-height panel; spacing is distributed
                by the container (no fixed gap) — self-adjusts when column height changes.
              */}
              <ul className="mt-5 flex min-h-0 flex-1 flex-col justify-evenly">
                {CUSTOM_POOL_UNLOCK_FEATURES.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <li key={feature.id} className="flex items-start gap-3">
                      <span
                        className="flex shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10"
                        style={{
                          width: UPGRADE_FEATURE_ICON_PX,
                          height: UPGRADE_FEATURE_ICON_PX,
                        }}
                      >
                        <Icon
                          className="h-5 w-5 text-primary"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="font-display text-base font-semibold leading-snug tracking-wide text-foreground">
                          {feature.name}
                        </p>
                        <p
                          className="mt-0.5 font-sans text-xs leading-snug text-muted-foreground"
                          style={{ maxWidth: UPGRADE_FEATURE_DESC_MAX_W }}
                        >
                          {feature.description}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
