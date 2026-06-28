export type MobileBottomNavId =
  | 'profile'
  | 'pools'
  | 'upcoming'
  | 'how-it-works'
  | 'chat'

/** Dashboard footer tabs only (excludes Chat). */
export type DashboardBottomNavId = Exclude<MobileBottomNavId, 'chat'>

export const DASHBOARD_NAV_ID_TO_TAB_VALUE: Record<DashboardBottomNavId, string> =
  {
    pools: 'pools',
    upcoming: 'games',
    profile: 'profile',
    'how-it-works': 'how-it-works',
  }

export const DASHBOARD_TAB_VALUE_TO_NAV_ID: Record<string, DashboardBottomNavId> =
  {
    pools: 'pools',
    games: 'upcoming',
    profile: 'profile',
    'how-it-works': 'how-it-works',
  }

export function isDashboardBottomNavId(
  id: MobileBottomNavId,
): id is DashboardBottomNavId {
  return id !== 'chat'
}

export const MOBILE_BOTTOM_NAV_PAD_CLASS =
  'max-sm:pb-[calc(3.875rem+env(safe-area-inset-bottom,0px))]'

/**
 * MobileBottomNav total height: pt-1.5 + h-12 + pb-0.5 + safe-area (matches
 * components/mobile-bottom-nav.tsx).
 */
export const MOBILE_BOTTOM_NAV_HEIGHT_CSS =
  'calc(3.875rem + env(safe-area-inset-bottom, 0px))'

/** SaveBar content height: py-3 + min-h-44 button + py-3 (no extra safe-area when above nav). */
export const SAVE_BAR_HEIGHT_CSS = '4.25rem'

/** Combined scroll inset when a fixed save bar sits above the mobile bottom nav. */
export const MOBILE_SAVE_BAR_WITH_NAV_SCROLL_PAD_CLASS =
  'max-sm:pb-[calc(4.25rem+3.875rem+env(safe-area-inset-bottom,0px))] sm:pb-20'

/**
 * Extra scroll inset for the save bar when an ancestor already applies
 * MOBILE_BOTTOM_NAV_PAD_CLASS (e.g. pool home).
 */
export const MOBILE_SAVE_BAR_SCROLL_PAD_ABOVE_NAV_CLASS =
  'max-sm:pb-[4.25rem] sm:pb-20'

/**
 * Scroll inset when the save bar is the only fixed bottom chrome (e.g. /predict;
 * mobile nav is hidden there).
 */
export const SAVE_BAR_SOLO_SCROLL_PAD_CLASS = 'pb-20'

/** Tailwind `bottom` offset for SaveBar when stacked above MobileBottomNav. */
export const SAVE_BAR_ABOVE_MOBILE_NAV_BOTTOM_CLASS =
  'max-sm:bottom-[calc(3.875rem+env(safe-area-inset-bottom,0px))]'

export const DASHBOARD_TAB_HREFS = {
  profile: '/dashboard?tab=profile',
  pools: '/dashboard?tab=pools',
  upcoming: '/dashboard?tab=upcoming',
  'how-it-works': '/dashboard?tab=how-it-works',
} as const

export const CHAT_INBOX_HREF = '/chat'

export function resolveMobileBottomNavActive(
  pathname: string,
  tabParam: string | null,
): MobileBottomNavId | null {
  if (pathname === '/chat') return 'chat'

  if (pathname === '/dashboard') {
    if (tabParam === 'profile') return 'profile'
    if (tabParam === 'upcoming') return 'upcoming'
    if (tabParam === 'how-it-works') return 'how-it-works'
    return 'pools'
  }

  if (pathname.startsWith('/pool/')) {
    if (tabParam === 'chat') return 'chat'
    return 'pools'
  }

  if (pathname === '/create' || pathname.startsWith('/join/')) {
    return 'pools'
  }

  if (pathname.startsWith('/match/')) {
    return 'upcoming'
  }

  return null
}
