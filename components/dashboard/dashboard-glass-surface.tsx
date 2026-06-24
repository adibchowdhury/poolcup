import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const DASHBOARD_GLASS_SURFACE_FULL_BASE = cn(
  'relative overflow-hidden border border-white/15 backdrop-blur-2xl',
  'shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.14),inset_0_-2px_4px_0_rgba(0,0,0,0.55),inset_0_2px_6px_0_rgba(255,255,255,0.06)]',
  'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#a3b5ab]/55 before:to-transparent',
)

const DASHBOARD_GLASS_SURFACE_COMPACT_BASE = cn(
  'relative overflow-hidden border border-white/15 backdrop-blur-xl',
  'shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1)]',
  'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#a3b5ab]/40 before:to-transparent',
)

export const DASHBOARD_GLASS_ROUNDED = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
} as const

export type DashboardGlassRounded = keyof typeof DASHBOARD_GLASS_ROUNDED

export function dashboardGlassSurfaceClass(
  rounded: DashboardGlassRounded = '2xl',
  variant: 'full' | 'compact' = 'full',
): string {
  const base =
    variant === 'compact'
      ? DASHBOARD_GLASS_SURFACE_COMPACT_BASE
      : DASHBOARD_GLASS_SURFACE_FULL_BASE
  return cn(base, DASHBOARD_GLASS_ROUNDED[rounded])
}

const DASHBOARD_GLASS_BACKDROP_RADIAL_FULL_STYLE: CSSProperties = {
  background:
    'radial-gradient(80% 60% at 20% 15%, hsl(var(--primary) / 0.40), transparent 55%), radial-gradient(70% 60% at 85% 25%, rgba(255,179,0,0.16), transparent 55%), #0D1F14',
}

const DASHBOARD_GLASS_BACKDROP_RADIAL_COMPACT_STYLE: CSSProperties = {
  background:
    'radial-gradient(80% 80% at 50% 0%, hsl(var(--primary) / 0.28), transparent 70%), #0D1F14',
}

const DASHBOARD_GLASS_BACKDROP_TINT_STYLE: CSSProperties = {
  background: 'rgba(176, 224, 196, 0.05)',
}

const DASHBOARD_GLASS_BACKDROP_HIGHLIGHT_STYLE: CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.022) 8%, transparent 16%)',
}

export function DashboardGlassBackdrops({
  variant = 'full',
}: {
  variant?: 'full' | 'compact'
}) {
  const radialStyle =
    variant === 'compact'
      ? DASHBOARD_GLASS_BACKDROP_RADIAL_COMPACT_STYLE
      : DASHBOARD_GLASS_BACKDROP_RADIAL_FULL_STYLE

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-30"
        style={radialStyle}
      />
      {variant === 'full' ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-20"
            style={DASHBOARD_GLASS_BACKDROP_TINT_STYLE}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={DASHBOARD_GLASS_BACKDROP_HIGHLIGHT_STYLE}
          />
        </>
      ) : null}
    </>
  )
}

type DashboardGlassSurfaceProps = {
  children: ReactNode
  className?: string
  rounded?: DashboardGlassRounded
  variant?: 'full' | 'compact'
} & Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'>

export function DashboardGlassSurface({
  children,
  className,
  rounded = '2xl',
  variant = 'full',
  ...props
}: DashboardGlassSurfaceProps) {
  return (
    <div
      className={cn(dashboardGlassSurfaceClass(rounded, variant), className)}
      {...props}
    >
      <DashboardGlassBackdrops variant={variant} />
      {children}
    </div>
  )
}
