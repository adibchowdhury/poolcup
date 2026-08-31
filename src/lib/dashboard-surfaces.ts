import { cn } from '@/lib/utils'

/**
 * Dashboard-only elevation ladder (zero green tint on surfaces).
 * Does not modify global --card, --muted, or bg-app-background tokens.
 */

/** Level 0 — page canvas (viewport fill on /dashboard route). */
export const DASHBOARD_CANVAS_BG = '#0D0D0D'
export const DASHBOARD_CANVAS_CLASS = 'bg-[#0D0D0D]'

/**
 * Pool desktop shell canvas — same level-0 surface as dashboard routes.
 * Global `--app-background` (#131313) is unchanged; pool pages use this override.
 */
export const POOL_DESKTOP_CANVAS_BG = DASHBOARD_CANVAS_BG
export const POOL_DESKTOP_CANVAS_CLASS = DASHBOARD_CANVAS_CLASS

/** Sticky pool top bar / mobile header on pool routes. */
export const POOL_DESKTOP_CHROME_SURFACE_CLASS = 'bg-[#0D0D0D]/95'

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

/**
 * Desktop sidebar surface — hub (`HUB_DESKTOP_SIDEBAR_CLASS`) and pool shells.
 * Literal hex in Tailwind classes must match `DASHBOARD_CARD_BG`.
 */
export const DESKTOP_SIDEBAR_BG = DASHBOARD_CARD_BG
export const DESKTOP_SIDEBAR_BORDER = DASHBOARD_CARD_BORDER

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

/** Empty/error states on Matches tab — card surface on desktop. */
export const DASHBOARD_MATCHES_EMPTY_STATE_CLASS = cn(
  'rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center',
  'lg:border-solid lg:border-[#292929] lg:bg-[#171717]',
)

/** Matches tab card grid — full-width hub layout, 4 cols at xl+. */
export const DASHBOARD_MATCHES_GRID_CLASS =
  'grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

/** Fixed card height — live strip and grid cards stay pixel-identical on desktop. */
/**
 * Matches tab PremiumMatchCard stack (px, sm+ / desktop grid):
 * pt-8 (32) + event min-h-8 (32) + grid mt-2.5 (10)
 * + team col logo h-16 (64) + mt-1.5 (6) + name min-h-8 (32) = 102
 * + footer border-t + pt-2 + line (~15) + footer inset lg:pb-5 (20) + pb-3 (12) ≈ 44
 * → 232 on desktop; + sculpt / subpixel buffer → 240 at lg+.
 */
export const DASHBOARD_MATCHES_CARD_FOOTER_INSET_PX = 20
export const DASHBOARD_MATCHES_CARD_HEIGHT_PX = 220
export const DASHBOARD_MATCHES_CARD_HEIGHT_DESKTOP_PX = 240
export const DASHBOARD_MATCHES_CARD_HEIGHT_CLASS = 'h-[220px] lg:h-[240px]'

/**
 * Live strip cell width — mirrors one column of DASHBOARD_MATCHES_GRID_CLASS
 * (gap-2.5 = 0.625rem; n cols ⇒ (n − 1) gaps).
 */
export const DASHBOARD_MATCHES_CARD_CELL_WIDTH_CLASS = cn(
  'w-[calc((100cqw-1.25rem)/3)]',
  'xl:w-[calc((100cqw-1.875rem)/4)]',
)

export const DASHBOARD_MATCHES_LIVE_STRIP_CARD_CELL_CLASS = cn(
  'flex-none shrink-0',
  DASHBOARD_MATCHES_CARD_CELL_WIDTH_CLASS,
)

/**
 * Desktop Matches tab carousel item — fixed grid column width + height (no flex stretch).
 * Width uses cqw against the @container scrollport; peek comes from overflow, not card resize.
 */
export const DASHBOARD_MATCHES_CAROUSEL_ITEM_CLASS = cn(
  'flex-none shrink-0',
  DASHBOARD_MATCHES_CARD_CELL_WIDTH_CLASS,
  'h-[240px]',
)

/** Desktop section panel for Matches tab lists (level 1). Mobile: unstyled. */
export const DASHBOARD_MATCHES_SECTION_PANEL_CLASS = cn(
  'lg:rounded-2xl lg:border lg:border-[#292929] lg:bg-[#111111] lg:p-5 xl:p-6',
)

/** Pool card shell (dashboard + outline surfaces). */
export const DASHBOARD_POOL_CARD_CLASS = cn(
  'overflow-hidden rounded-2xl border border-[#292929] bg-[#171717] transition-colors hover:bg-[#1d1d1d]',
)
