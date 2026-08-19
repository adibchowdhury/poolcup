/** Values for hub desktop nav (sidebar + legacy horizontal nav). */
export type HubDesktopNavId =
  | 'games'
  | 'friends'
  | 'dashboard'
  | 'discover'
  | 'profile'
  | 'inbox'

/** Shared horizontal inset for hub top bar + main content (lg+ alignment). */
export const HUB_DESKTOP_CONTENT_GUTTER_CLASS = 'px-4 lg:px-6 xl:px-8'

/** Fixed left sidebar width (~240–260px). */
export const HUB_DESKTOP_SIDEBAR_WIDTH_CLASS = 'w-[250px]'

/** Fixed sidebar surface — lg+ only; pairs with a matching width spacer. */
export const HUB_DESKTOP_SIDEBAR_CLASS =
  'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#292929] bg-[#171717] lg:flex'

/** Nav item hover on sidebar (#171717 surface). */
export const HUB_DESKTOP_SIDEBAR_HOVER_CLASS = 'hover:bg-[#1d1d1d]'

/**
 * @deprecated Horizontal nav strip removed at lg+; kept for reference during migration.
 */
export const HUB_DESKTOP_NAV_STRIP_CLASS =
  'mx-auto hidden w-full min-w-0 max-w-6xl px-4 pt-8 lg:hidden'
