/** Values for DashboardDesktopNav Tabs (matches dashboard-desktop-nav triggers). */
export type HubDesktopNavId =
  | 'games'
  | 'friends'
  | 'dashboard'
  | 'discover'
  | 'profile'

/**
 * Fixed desktop hub-nav chrome (lg+/sm+). Always the same width and top offset;
 * page `mainClassName` must not be applied here.
 */
export const HUB_DESKTOP_NAV_STRIP_CLASS =
  'mx-auto hidden w-full min-w-0 max-w-6xl px-4 pt-8 sm:block'
