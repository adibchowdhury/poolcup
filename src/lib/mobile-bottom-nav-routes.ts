export type MobileBottomNavId =
  | 'profile'
  | 'pools'
  | 'upcoming'
  | 'how-it-works'
  | 'chat'

export const MOBILE_BOTTOM_NAV_PAD_CLASS =
  'max-sm:pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))]'

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

  return null
}
