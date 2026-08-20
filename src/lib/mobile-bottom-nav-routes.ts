export type MobileBottomNavId =
  | 'profile'
  | 'dashboard'
  | 'upcoming'
  | 'how-it-works'
  | 'discover'
  | 'friends'

/** Dashboard footer tabs only (excludes Discover + Friends hub routes). */
export type DashboardBottomNavId = Exclude<
  MobileBottomNavId,
  'discover' | 'friends'
>

export const DASHBOARD_NAV_ID_TO_TAB_VALUE: Record<DashboardBottomNavId, string> =
  {
    dashboard: 'dashboard',
    upcoming: 'games',
    profile: 'profile',
    'how-it-works': 'how-it-works',
  }

export const DASHBOARD_TAB_VALUE_TO_NAV_ID: Record<string, DashboardBottomNavId> =
  {
    dashboard: 'dashboard',
    /** Legacy alias from when the home tab was labeled "Pools". */
    pools: 'dashboard',
    games: 'upcoming',
    profile: 'profile',
    'how-it-works': 'how-it-works',
  }

export function isDashboardBottomNavId(
  id: MobileBottomNavId,
): id is DashboardBottomNavId {
  return id !== 'discover' && id !== 'friends'
}

export const MOBILE_BOTTOM_NAV_PAD_CLASS =
  'max-lg:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'

/**
 * Full-width bottom nav footprint: bar (~4.25rem) + elevated home overhang +
 * safe-area (matches components/mobile-bottom-nav.tsx).
 */
export const MOBILE_BOTTOM_NAV_HEIGHT_CSS =
  'calc(5.5rem + env(safe-area-inset-bottom, 0px))'

/** SaveBar content height: py-3 + min-h-44 button + py-3 (no extra safe-area when above nav). */
export const SAVE_BAR_HEIGHT_CSS = '4.25rem'

/** Combined scroll inset when a fixed save bar sits above the mobile bottom nav. */
export const MOBILE_SAVE_BAR_WITH_NAV_SCROLL_PAD_CLASS =
  'max-lg:pb-[calc(4.25rem+5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-20'

/**
 * Extra scroll inset for the save bar when an ancestor already applies
 * MOBILE_BOTTOM_NAV_PAD_CLASS (e.g. pool home).
 */
export const MOBILE_SAVE_BAR_SCROLL_PAD_ABOVE_NAV_CLASS =
  'max-lg:pb-[4.25rem] lg:pb-20'

/**
 * Scroll inset when the save bar is the only fixed bottom chrome (e.g. /predict;
 * mobile nav is hidden there).
 */
export const SAVE_BAR_SOLO_SCROLL_PAD_CLASS = 'pb-20'

/** Tailwind `bottom` offset for SaveBar when stacked above MobileBottomNav. */
export const SAVE_BAR_ABOVE_MOBILE_NAV_BOTTOM_CLASS =
  'max-lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'

export const DASHBOARD_TAB_HREFS = {
  profile: '/dashboard?tab=profile',
  dashboard: '/dashboard?tab=dashboard',
  /** @deprecated Use DASHBOARD_TAB_HREFS.dashboard — kept for older call sites. */
  pools: '/dashboard?tab=dashboard',
  upcoming: '/dashboard?tab=upcoming',
  'how-it-works': '/dashboard?tab=how-it-works',
} as const

/** Matches tab filter: only events from the user's classic pools. */
export const MATCHES_MINE_FILTER = 'mine' as const

export const DASHBOARD_MATCHES_MINE_HREF =
  `/dashboard?tab=upcoming&filter=${MATCHES_MINE_FILTER}` as const

export const CHAT_INBOX_HREF = '/chat'
export const DISCOVER_HREF = '/discover'
export const FRIENDS_HREF = '/friends'

/** Desktop hub nav Tabs value from the current pathname (null = hide hub nav). */
export function resolveHubDesktopNavValue(
  pathname: string,
  tabParam: string | null,
): string | null {
  if (pathname === '/friends' || pathname.startsWith('/friends')) {
    return 'friends'
  }
  if (pathname === '/discover') return 'discover'
  if (pathname === '/chat') return 'inbox'
  if (pathname === '/dashboard') {
    if (tabParam === 'profile') return 'profile'
    if (tabParam === 'upcoming') return 'games'
    if (tabParam === 'how-it-works') return 'how-it-works'
    return 'dashboard'
  }
  return null
}

export function resolveMobileBottomNavActive(
  pathname: string,
  tabParam: string | null,
): MobileBottomNavId | null {
  // Chat lives in the top bar now — no bottom-nav active state.
  if (pathname === '/chat' || pathname.startsWith('/chat/')) return null
  if (pathname === '/discover') return 'discover'
  if (pathname === '/friends' || pathname.startsWith('/friends')) return 'friends'

  if (pathname === '/dashboard') {
    if (tabParam === 'profile') return 'profile'
    if (tabParam === 'upcoming') return 'upcoming'
    if (tabParam === 'how-it-works') return 'how-it-works'
    // Default home + legacy ?tab=pools
    return 'dashboard'
  }

  if (pathname.startsWith('/pool/')) {
    return 'dashboard'
  }

  if (pathname.startsWith('/join/')) {
    return 'dashboard'
  }

  if (pathname.startsWith('/match/')) {
    return 'upcoming'
  }

  return null
}
