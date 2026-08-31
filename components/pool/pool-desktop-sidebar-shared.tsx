'use client'

import Image from 'next/image'
import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, Target, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PoolCupLogo } from '@/components/poolcup-logo'
import {
  HUB_DESKTOP_SIDEBAR_CLASS,
  HUB_DESKTOP_SIDEBAR_NAV_ITEM_CLASS,
  HUB_DESKTOP_SIDEBAR_WIDTH_CLASS,
} from '@/components/dashboard/hub-desktop-nav-frame'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { startCustomPoolCheckout } from '@/src/lib/custom-pool-checkout-client'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'

/** Shared section content inset — labels + body share this left edge (12px). */
export const POOL_DESKTOP_SIDEBAR_SECTION_INSET_CLASS = 'px-3'

export const poolDesktopSidebarSectionLabelClassName =
  'pb-1 pt-0.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70'

export const poolDesktopSidebarNavTriggerClassName = cn(
  HUB_DESKTOP_SIDEBAR_NAV_ITEM_CLASS,
  'inline-flex h-auto w-full min-w-0 items-center justify-start gap-2 rounded-lg py-2 text-sm font-medium',
  'border-transparent text-muted-foreground transition-colors duration-150',
  'hover:bg-[#1d1d1d] hover:text-foreground',
  // Kill TabsTrigger default active outline wash; fill/bar/padding from globals.css
  'data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none',
  FOCUS_VISIBLE_RING,
)

export function PoolDesktopSidebarSeparator() {
  return (
    <div className="mx-3 shrink-0 border-t border-[#292929]" role="separator" />
  )
}

export function PoolDesktopSidebarLogo() {
  return (
    <div
      className={cn(
        'shrink-0 pb-2 pt-3',
        POOL_DESKTOP_SIDEBAR_SECTION_INSET_CLASS,
      )}
    >
      <PoolCupLogo
        href={DASHBOARD_TAB_HREFS.dashboard}
        linkClassName="flex w-full justify-start"
        className="!h-auto !w-[85%] sm:!h-auto sm:!w-[85%]"
      />
    </div>
  )
}

/** POOL nav — Predictions / Leaderboard TabsTriggers (parent Tabs required). */
export function PoolDesktopSidebarPoolNav() {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-0.5 pb-2 pt-2',
        POOL_DESKTOP_SIDEBAR_SECTION_INSET_CLASS,
      )}
    >
      <p className={poolDesktopSidebarSectionLabelClassName}>Pool</p>
      <TabsList className="flex h-auto w-full flex-col gap-0.5 bg-transparent p-0">
        <TabsTrigger
          value="predictions"
          className={poolDesktopSidebarNavTriggerClassName}
        >
          <Target className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 truncate">Predictions</span>
        </TabsTrigger>
        <TabsTrigger
          value="leaderboard"
          className={poolDesktopSidebarNavTriggerClassName}
        >
          <Trophy className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 truncate">Leaderboard</span>
        </TabsTrigger>
      </TabsList>
    </div>
  )
}

/**
 * Bottom-anchored Commissioner upsell.
 * `compact` shrinks Pucky + padding for short viewports (no-scroll fit).
 */
export function PoolDesktopCommissionerCta({
  poolId,
  compact = false,
}: {
  poolId?: string
  compact?: boolean
}) {
  const [upgradeBusy, setUpgradeBusy] = useState(false)

  async function handleUpgrade() {
    if (!poolId || upgradeBusy) return
    setUpgradeBusy(true)
    const result = await startCustomPoolCheckout(poolId)
    if (!result.ok) {
      toast.error(result.error)
      setUpgradeBusy(false)
      return
    }
    window.location.href = result.url
  }

  const pucky = compact ? 64 : 96

  return (
    <div
      className={cn(
        'mt-auto shrink-0 border-t border-[#292929]',
        compact ? 'p-2' : 'p-3',
      )}
    >
      <div
        className={cn(
          'rounded-xl border border-[#292929] bg-[#141414]',
          compact ? 'px-2.5 py-2.5' : 'px-3.5 py-4',
        )}
      >
        <div className={cn('flex items-start', compact ? 'gap-2' : 'gap-3')}>
          <Image
            src="/mascot/pucky_trophy.png"
            alt=""
            width={pucky}
            height={pucky}
            className={cn(
              'shrink-0 object-contain',
              compact ? 'h-16 w-16' : 'h-24 w-24',
            )}
          />
          <div
            className={cn(
              'min-w-0 flex-1 text-left',
              compact ? 'pt-0.5' : 'pt-1',
            )}
          >
            <p className="text-sm font-medium leading-snug text-foreground">
              Make your pool standout
            </p>
            <p
              className={cn(
                'text-[11px] leading-snug text-muted-foreground',
                compact ? 'mt-1' : 'mt-1.5',
              )}
            >
              Customize branding, scoring & more as Commissioner
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={!poolId || upgradeBusy}
          onClick={() => void handleUpgrade()}
          className={cn(
            'w-full px-2 text-[12px] font-semibold leading-none',
            compact ? 'mt-2 h-8' : 'mt-3.5 h-9',
            FOCUS_VISIBLE_RING,
          )}
        >
          {upgradeBusy ? (
            <>
              <Loader2
                className="mr-1.5 h-3.5 w-3.5 animate-spin"
                aria-hidden
              />
              Starting…
            </>
          ) : (
            'Upgrade to Commissioner'
          )}
        </Button>
      </div>
    </div>
  )
}

/** Fixed full-height sidebar frame + flow spacer (hub width). */
export function PoolDesktopSidebarFrame({
  children,
  className,
  ariaLabel = 'Pool navigation',
}: {
  children: ReactNode
  className?: string
  ariaLabel?: string
}) {
  return (
    <>
      <aside
        className={cn(
          HUB_DESKTOP_SIDEBAR_CLASS,
          HUB_DESKTOP_SIDEBAR_WIDTH_CLASS,
          'overflow-hidden',
          className,
        )}
        aria-label={ariaLabel}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {children}
        </div>
      </aside>
      <div
        className={cn(
          'hidden shrink-0 lg:block',
          HUB_DESKTOP_SIDEBAR_WIDTH_CLASS,
        )}
        aria-hidden
      />
    </>
  )
}

/** True when the Commissioner CTA should compact for short viewports. */
export function usePoolDesktopSidebarCompactCta(
  thresholdPx = 840,
): boolean {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    function update() {
      setCompact(window.innerHeight < thresholdPx)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [thresholdPx])
  return compact
}
