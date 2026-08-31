import { cn } from '@/lib/utils'

/** Borderless dark surface — shared upgrade checkout card (desktop + mobile). */
export const POOL_UPGRADE_CARD_SURFACE_CLASS =
  'rounded-2xl bg-[#141414] shadow-[0_12px_40px_rgba(0,0,0,0.34)]'

export type PoolUpgradePriceCardProps = {
  className?: string
  /**
   * Desktop default: show the pipe benefits row under the pay-once sentence.
   * Mobile upgrade sheet passes false (footer trust row owns that message).
   */
  showBenefitsRow?: boolean
}

/**
 * Custom Pool price card — shared markup for desktop upgrade page and mobile
 * upgrade sheet. Desktop keeps the benefits row; mobile can hide it via prop.
 */
export function PoolUpgradePriceCard({
  className,
  showBenefitsRow = true,
}: PoolUpgradePriceCardProps) {
  return (
    <div
      className={cn(
        POOL_UPGRADE_CARD_SURFACE_CLASS,
        'px-6 py-8 text-center',
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Custom Pool
      </p>
      <p className="mt-4 font-display text-6xl leading-none tracking-wide text-foreground">
        $9.99
      </p>
      <p className="mt-1 font-sans text-base font-semibold text-primary">
        one-time
      </p>
      <p className="mt-4 font-sans text-base leading-relaxed text-foreground/90">
        Pay once. Keep all Custom Pool features for this pool.
      </p>
      {showBenefitsRow ? (
        <p className="mt-4 font-sans text-sm text-muted-foreground">
          One-time payment&nbsp;&nbsp;|&nbsp;&nbsp;No
          subscription&nbsp;&nbsp;|&nbsp;&nbsp;Keep forever
        </p>
      ) : null}
    </div>
  )
}
