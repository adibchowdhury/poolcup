import { cn } from '@/lib/utils'

/**
 * Dashboard-only elevation ladder (zero green tint on surfaces).
 * Does not modify global --card, --muted, or bg-app-background tokens.
 */

/** Level 0 — page canvas (viewport fill on /dashboard route). */
export const DASHBOARD_CANVAS_BG = '#0D0D0D'
export const DASHBOARD_CANVAS_CLASS = 'bg-[#0D0D0D]'

/** True for `/dashboard` and nested dashboard paths. */
export function isDashboardRoutePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return normalized === '/dashboard' || normalized.startsWith('/dashboard/')
}

/** Level 1 — section panels (Your Pools, rail, Discover section wrappers). */
export const DASHBOARD_SECTION_BG = '#111111'

/** Level 2 — cards inside sections (pool cards, Live Now rows, rail picks). */
export const DASHBOARD_CARD_BG = '#171717'
export const DASHBOARD_CARD_BG_HOVER = '#1d1d1d'
export const DASHBOARD_CARD_BORDER = '#292929'

/** In-card neutral wells (progress track, badge fill, logo well). */
export const DASHBOARD_CARD_INNER_SURFACE = '#222222'
export const DASHBOARD_CARD_INNER_SUBTLE = '#202020'

/**
 * Scoped muted foreground for dashboard home (#5a7080 is ~4:1 on #171717).
 * Applied via [--muted-foreground] on the dashboard home wrapper only.
 */
export const DASHBOARD_MUTED_FOREGROUND = '#8494a3'

/** Scoped muted text on dashboard home tab only (not the page canvas). */
export const DASHBOARD_HOME_MUTED_SCOPE_CLASS = '[--muted-foreground:#8494a3]'

/** @deprecated Use DASHBOARD_HOME_MUTED_SCOPE_CLASS — canvas lives on hub shell. */
export const DASHBOARD_HOME_SCOPE_CLASS = DASHBOARD_HOME_MUTED_SCOPE_CLASS

/** Outer section panel chrome. */
export const DASHBOARD_HOME_PANEL_CLASS = cn(
  'min-w-0 rounded-2xl border border-[#292929] bg-[#111111] p-4 sm:p-5 lg:p-6',
)

/** Inner feed card — filled surface at level 2. */
export const DASHBOARD_FEED_SURFACE_CLASS = cn(
  'rounded-xl border border-[#292929] bg-[#171717]',
)

export const DASHBOARD_FEED_SURFACE_CLASS_LG = cn(
  'rounded-2xl border border-[#292929] bg-[#171717]',
)

export const DASHBOARD_CARD_HOVER_CLASS = 'transition-colors hover:bg-[#1d1d1d]'

/** Pool card shell (dashboard + outline surfaces). */
export const DASHBOARD_POOL_CARD_CLASS = cn(
  'overflow-hidden rounded-2xl border border-[#292929] bg-[#171717] transition-colors hover:bg-[#1d1d1d]',
)
