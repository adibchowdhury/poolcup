/** Query value for the temporary all-in-one settings page. */
export const POOL_SETTINGS_LEGACY_SECTION = 'all'

export const POOL_SETTINGS_SECTIONS = [
  {
    id: 'details',
    title: 'Pool Details',
    subtitle: 'Name, description, image, competition, pool type.',
    items: [
      'Name',
      'Description',
      'Image (logo & color)',
      'Competition',
      'Pool type',
    ],
    destructive: false,
  },
  {
    id: 'scoring',
    title: 'Scoring & Predictions',
    subtitle:
      'Scoring rules, prediction deadlines/locking, visibility of other picks, bonus settings.',
    items: [
      'Scoring rules',
      'Prediction deadlines / locking',
      'Visibility of other picks',
      'Bonus settings',
    ],
    destructive: false,
  },
  {
    id: 'members',
    title: 'Members',
    subtitle:
      'Member list, invite link/code, approve requests, remove/ban members, transfer ownership.',
    items: [
      'Member list',
      'Invite link / code',
      'Approve requests',
      'Remove / ban members',
      'Transfer ownership',
    ],
    destructive: false,
  },
  {
    id: 'communication',
    title: 'Communication',
    subtitle: 'Announcements, pool chat settings, notifications.',
    items: ['Announcements', 'Pool chat settings', 'Notifications'],
    destructive: false,
  },
  {
    id: 'commissioner',
    title: 'Commissioner Controls',
    subtitle: 'Co-commissioners, permissions, privacy, join approval.',
    items: [
      'Co-commissioners',
      'Permissions',
      'Privacy',
      'Join approval',
    ],
    destructive: false,
  },
  {
    id: 'danger',
    title: 'Danger Zone',
    subtitle: 'Leave/delete/archive pool.',
    destructive: true,
    items: ['Leave pool', 'Delete pool', 'Archive pool'],
  },
] as const

export type PoolSettingsSectionId =
  (typeof POOL_SETTINGS_SECTIONS)[number]['id']

export function isPoolSettingsSectionId(
  value: string | null,
): value is PoolSettingsSectionId {
  return POOL_SETTINGS_SECTIONS.some((section) => section.id === value)
}

export type PoolSettingsRouteSection = PoolSettingsSectionId

export function normalizePoolSettingsSection(
  value: string | null | undefined,
): PoolSettingsRouteSection | null {
  if (!value) return null
  if (isPoolSettingsSectionId(value)) return value
  return null
}

export function poolPagePath(inviteCode: string): string {
  return `/pool/${encodeURIComponent(inviteCode)}`
}

export function poolUpgradePath(inviteCode: string): string {
  return `${poolPagePath(inviteCode)}/upgrade`
}

export function poolHomePath(inviteCode: string): string {
  return `${poolPagePath(inviteCode)}/home`
}

/** Mobile pool page with Home tab active. */
export function poolHomeTabPath(inviteCode: string): string {
  return `${poolPagePath(inviteCode)}?tab=home`
}

export function parsePoolHomeFromPath(pathname: string): boolean {
  return /\/pool\/[^/]+\/home\/?$/.test(pathname)
}

/** Mobile pool page with upgrade sheet open (settings tab underneath). */
export function poolUpgradeTabPath(inviteCode: string): string {
  return poolUpgradeMobileQueryPath(inviteCode, 'settings')
}

/** Mobile deep link — opens full-screen upgrade sheet over the pool page. */
export function poolUpgradeMobileQueryPath(
  inviteCode: string,
  tab: string = 'settings',
): string {
  const params = new URLSearchParams({ tab, upgrade: '1' })
  return `${poolPagePath(inviteCode)}?${params.toString()}`
}

export function parsePoolUpgradeFromPath(pathname: string): boolean {
  return /\/pool\/[^/]+\/upgrade\/?$/.test(pathname)
}

export function poolSettingsPath(
  inviteCode: string,
  section?: string | null,
  controlId?: string | null,
): string {
  const base = `${poolPagePath(inviteCode)}/settings`
  const normalized = normalizePoolSettingsSection(section)
  const path = normalized ? `${base}/${encodeURIComponent(normalized)}` : base
  if (!controlId) return path
  const sub =
    isPoolSettingsControlId(controlId) ? controlId : null
  if (!sub) return path
  const params = new URLSearchParams({ sub })
  return `${path}?${params.toString()}`
}

export function normalizePoolSettingsControlId(
  value: string | null | undefined,
): PoolSettingsControlId | null {
  if (!value) return null
  if (isPoolSettingsControlId(value)) return value
  return SEARCH_CONTROL_ALIASES[value] ?? null
}

/** Parse `/pool/{invite}/settings/{section}` from a pathname (client URL sync). */
export function parsePoolSettingsSectionFromPath(
  pathname: string,
): PoolSettingsSectionId | null {
  const match = pathname.match(/\/pool\/[^/]+\/settings\/([^/?#]+)/)
  if (!match) return null
  return normalizePoolSettingsSection(match[1])
}

/** Parse `?sub=` from a search string (client URL sync). */
export function parsePoolSettingsSubFromSearch(
  search: string,
): PoolSettingsControlId | null {
  const raw = search.startsWith('?') ? search.slice(1) : search
  return normalizePoolSettingsControlId(
    new URLSearchParams(raw).get('sub'),
  )
}

/** Read section + subsection from `window.location` (popstate / shallow nav). */
export function readPoolSettingsClientRoute(): {
  section: PoolSettingsSectionId | null
  sub: PoolSettingsControlId | null
} {
  if (typeof window === 'undefined') {
    return { section: null, sub: null }
  }
  return {
    section: parsePoolSettingsSectionFromPath(window.location.pathname),
    sub: parsePoolSettingsSubFromSearch(window.location.search),
  }
}

/**
 * Update the URL without a Next.js navigation (no RSC refetch).
 * App Router has no Pages-router shallow routing; History API is the supported pattern.
 */
export function shallowPoolSettingsUrl(
  url: string,
  mode: 'push' | 'replace' = 'replace',
): void {
  if (typeof window === 'undefined') return
  const state = window.history.state
  if (mode === 'push') {
    window.history.pushState(state, '', url)
  } else {
    window.history.replaceState(state, '', url)
  }
}

/** Pool page with the Settings tab active (mobile inline tab). */
export function poolSettingsTabPath(
  inviteCode: string,
  section?: string | null,
): string {
  const params = new URLSearchParams({ tab: 'settings' })
  const normalized = normalizePoolSettingsSection(section)
  if (normalized) params.set('section', normalized)
  return `${poolPagePath(inviteCode)}?${params.toString()}`
}

export function isPoolSettingsPath(pathname: string): boolean {
  return /\/pool\/[^/]+\/settings(\/|$)/.test(pathname)
}

/** Tailwind `lg` — desktop uses `/pool/{invite}/settings/{section}` routes. */
export const POOL_SETTINGS_DESKTOP_MQ = '(min-width: 1024px)'

/** @deprecated Prefer POOL_SETTINGS_DESKTOP_MQ */
export const POOL_SETTINGS_MODAL_MQ = POOL_SETTINGS_DESKTOP_MQ

/**
 * Below `lg` (1024px): mobile pool chrome — settings as `?tab=settings`,
 * upgrade as full-screen sheet (not `/upgrade` page).
 * lg+: desktop routes (`/settings/...`, `/upgrade` page).
 * One-shot check — for React UI prefer `usePoolSettingsMobileTab()`.
 */
export function shouldUsePoolSettingsMobileTab(): boolean {
  return !window.matchMedia(POOL_SETTINGS_DESKTOP_MQ).matches
}

/** @deprecated Desktop modal removed — use shouldUsePoolSettingsMobileTab or route to poolSettingsPath. */
export function shouldOpenPoolSettingsModal(): boolean {
  return shouldUsePoolSettingsMobileTab()
}

export type PoolSettingsSearchItem = {
  id: string
  name: string
  sectionId: PoolSettingsSectionId
  keywords: readonly string[]
}

/**
 * Sidebar sub-items for controls that actually exist in section screens.
 * Search ids match these when the result can jump to a control.
 */
export const POOL_SETTINGS_SUB_ITEMS = [
  { id: 'details-pool-type', sectionId: 'details', name: 'Pool type' },
  { id: 'details-competition', sectionId: 'details', name: 'Competition' },
  { id: 'details-name', sectionId: 'details', name: 'Pool name' },
  { id: 'details-description', sectionId: 'details', name: 'Description' },
  { id: 'details-activity', sectionId: 'details', name: 'Activity summary' },
  { id: 'details-logo', sectionId: 'details', name: 'Pool logo' },
  { id: 'details-color', sectionId: 'details', name: 'Pool color' },
  { id: 'scoring-rules', sectionId: 'scoring', name: 'Scoring rules' },
  { id: 'scoring-history', sectionId: 'scoring', name: 'Scoring history' },
  { id: 'members-invite-link', sectionId: 'members', name: 'Invite link' },
  { id: 'members-list', sectionId: 'members', name: 'Member list' },
  { id: 'members-transfer', sectionId: 'members', name: 'Transfer ownership' },
  { id: 'communication-announcements', sectionId: 'communication', name: 'Announcements' },
  { id: 'communication-polls', sectionId: 'communication', name: 'Polls' },
  { id: 'commissioner-exports', sectionId: 'commissioner', name: 'Exports' },
  { id: 'commissioner-join-approval', sectionId: 'commissioner', name: 'Open to new members' },
  { id: 'commissioner-privacy', sectionId: 'commissioner', name: 'Make pool public' },
  { id: 'commissioner-co-admins', sectionId: 'commissioner', name: 'Co-commissioners' },
  { id: 'commissioner-missing-predictions', sectionId: 'commissioner', name: 'Missing predictions' },
  { id: 'commissioner-moderation-log', sectionId: 'commissioner', name: 'Moderation log' },
  { id: 'danger-leave', sectionId: 'danger', name: 'Leave pool' },
  { id: 'danger-report', sectionId: 'danger', name: 'Report pool' },
  { id: 'danger-delete', sectionId: 'danger', name: 'Delete pool' },
] as const

export type PoolSettingsControlId =
  (typeof POOL_SETTINGS_SUB_ITEMS)[number]['id']

const SEARCH_CONTROL_ALIASES: Record<string, PoolSettingsControlId> = {
  'members-invite-code': 'members-invite-link',
  'members-remove': 'members-list',
  'scoring-deadlines': 'scoring-rules',
  'scoring-locking': 'scoring-rules',
}

export function poolSettingsControlElementId(controlId: string): string {
  return `pool-setting-${controlId}`
}

export function isPoolSettingsControlId(
  value: string,
): value is PoolSettingsControlId {
  return POOL_SETTINGS_SUB_ITEMS.some((item) => item.id === value)
}

export function subItemsForSection(sectionId: PoolSettingsSectionId) {
  return POOL_SETTINGS_SUB_ITEMS.filter((item) => item.sectionId === sectionId)
}

export function controlIdForSearchItem(
  item: PoolSettingsSearchItem,
): PoolSettingsControlId | null {
  if (isPoolSettingsControlId(item.id)) return item.id
  return SEARCH_CONTROL_ALIASES[item.id] ?? null
}

/**
 * Searchable settings index. Extend this as controls migrate into
 * section screens (add `controlId` later for deep links).
 */
export const POOL_SETTINGS_SEARCH_INDEX: readonly PoolSettingsSearchItem[] = [
  {
    id: 'details-name',
    name: 'Name',
    sectionId: 'details',
    keywords: ['pool name', 'rename', 'title'],
  },
  {
    id: 'details-description',
    name: 'Description',
    sectionId: 'details',
    keywords: ['about', 'bio', 'summary'],
  },
  {
    id: 'details-activity',
    name: 'Activity summary',
    sectionId: 'details',
    keywords: ['members count', 'activity', 'with points', 'zero points'],
  },
  {
    id: 'details-logo',
    name: 'Pool logo',
    sectionId: 'details',
    keywords: ['emblem', 'upload', 'replace logo', 'branding'],
  },
  {
    id: 'details-color',
    name: 'Pool color',
    sectionId: 'details',
    keywords: ['theme', 'hex', 'accent', 'branding', 'customize'],
  },
  {
    id: 'details-competition',
    name: 'Competition',
    sectionId: 'details',
    keywords: ['event', 'sport', 'tournament', 'world cup'],
  },
  {
    id: 'details-pool-type',
    name: 'Pool type',
    sectionId: 'details',
    keywords: ['classic', 'winner', 'scoring style', 'exact score'],
  },
  {
    id: 'scoring-rules',
    name: 'Scoring rules',
    sectionId: 'scoring',
    keywords: ['points', 'exact', 'winner', 'draw', 'custom scoring'],
  },
  {
    id: 'scoring-history',
    name: 'Scoring history',
    sectionId: 'scoring',
    keywords: ['recalculate', 'version', 'scoring changes'],
  },
  {
    id: 'scoring-deadlines',
    name: 'Deadlines',
    sectionId: 'scoring',
    keywords: ['deadline', 'lock time', 'kickoff', 'cutoff'],
  },
  {
    id: 'scoring-locking',
    name: 'Locking',
    sectionId: 'scoring',
    keywords: ['lock', 'locked', 'picks lock', 'deadline'],
  },
  {
    id: 'scoring-pick-visibility',
    name: 'Pick visibility',
    sectionId: 'scoring',
    keywords: ['hidden picks', 'show picks', 'other picks', 'visibility'],
  },
  {
    id: 'scoring-bonus',
    name: 'Bonus',
    sectionId: 'scoring',
    keywords: ['bonus settings', 'bonus points'],
  },
  {
    id: 'members-list',
    name: 'Member list',
    sectionId: 'members',
    keywords: ['roster', 'players', 'members'],
  },
  {
    id: 'members-invite-link',
    name: 'Invite link',
    sectionId: 'members',
    keywords: ['share', 'join link', 'invite'],
  },
  {
    id: 'members-invite-code',
    name: 'Invite code',
    sectionId: 'members',
    keywords: ['code', 'invite', 'join code'],
  },
  {
    id: 'members-approve',
    name: 'Approve requests',
    sectionId: 'members',
    keywords: ['join requests', 'approval', 'pending'],
  },
  {
    id: 'members-remove',
    name: 'Remove member',
    sectionId: 'members',
    keywords: ['kick', 'remove', 'eject'],
  },
  {
    id: 'members-ban',
    name: 'Ban',
    sectionId: 'members',
    keywords: ['ban member', 'banned'],
  },
  {
    id: 'members-transfer',
    name: 'Transfer ownership',
    sectionId: 'members',
    keywords: ['owner', 'transfer', 'hand off'],
  },
  {
    id: 'communication-announcements',
    name: 'Announcements',
    sectionId: 'communication',
    keywords: ['announce', 'pin', 'banner', 'post'],
  },
  {
    id: 'communication-polls',
    name: 'Polls',
    sectionId: 'communication',
    keywords: ['vote', 'poll', 'survey'],
  },
  {
    id: 'communication-chat',
    name: 'Chat',
    sectionId: 'communication',
    keywords: ['pool chat', 'messages', 'chat settings'],
  },
  {
    id: 'communication-notifications',
    name: 'Notifications',
    sectionId: 'communication',
    keywords: ['alerts', 'notify', 'push'],
  },
  {
    id: 'commissioner-co-admins',
    name: 'Co-commissioners',
    sectionId: 'commissioner',
    keywords: ['co-admin', 'admins', 'commissioner'],
  },
  {
    id: 'commissioner-exports',
    name: 'Exports',
    sectionId: 'commissioner',
    keywords: ['csv', 'print', 'download', 'leaderboard export', 'predictions export'],
  },
  {
    id: 'commissioner-missing-predictions',
    name: 'Members missing predictions',
    sectionId: 'commissioner',
    keywords: ['missing picks', 'nudge', 'haven’t predicted'],
  },
  {
    id: 'commissioner-moderation-log',
    name: 'Moderation log',
    sectionId: 'commissioner',
    keywords: ['audit', 'history', 'commissioner actions'],
  },
  {
    id: 'commissioner-permissions',
    name: 'Permissions',
    sectionId: 'commissioner',
    keywords: ['roles', 'access', 'tools'],
  },
  {
    id: 'commissioner-privacy',
    name: 'Privacy',
    sectionId: 'commissioner',
    keywords: ['public', 'private', 'discover', 'visibility'],
  },
  {
    id: 'commissioner-join-approval',
    name: 'Join approval',
    sectionId: 'commissioner',
    keywords: ['open to new members', 'accepting members', 'closed'],
  },
  {
    id: 'danger-leave',
    name: 'Leave pool',
    sectionId: 'danger',
    keywords: ['leave', 'exit', 'quit pool', 'membership'],
  },
  {
    id: 'danger-report',
    name: 'Report pool',
    sectionId: 'danger',
    keywords: ['report', 'abuse', 'flag'],
  },
  {
    id: 'danger-delete',
    name: 'Delete pool',
    sectionId: 'danger',
    keywords: ['delete', 'remove pool', 'destroy'],
  },
  {
    id: 'danger-archive',
    name: 'Archive',
    sectionId: 'danger',
    keywords: ['archive pool', 'close season'],
  },
] as const

export function sectionTitleForId(sectionId: PoolSettingsSectionId): string {
  return (
    POOL_SETTINGS_SECTIONS.find((section) => section.id === sectionId)?.title ??
    sectionId
  )
}

export function filterPoolSettingsSearch(
  query: string,
): PoolSettingsSearchItem[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const words = trimmed.split(/\s+/).filter(Boolean)

  return POOL_SETTINGS_SEARCH_INDEX.filter((item) => {
    const fields = [item.name, ...item.keywords].map((value) =>
      value.toLowerCase(),
    )
    if (fields.some((field) => field.includes(trimmed))) return true
    return words.some((word) =>
      fields.some((field) => field.includes(word)),
    )
  })
}
