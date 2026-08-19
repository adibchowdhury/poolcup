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

export function poolSettingsPath(
  inviteCode: string,
  section?: string | null,
): string {
  const base = `${poolPagePath(inviteCode)}/settings`
  const normalized = normalizePoolSettingsSection(section)
  if (!normalized) return base
  return `${base}/${encodeURIComponent(normalized)}`
}

export function isPoolSettingsPath(pathname: string): boolean {
  return /\/pool\/[^/]+\/settings(\/|$)/.test(pathname)
}

/** Tailwind `lg` — desktop settings open in a modal instead of the route. */
export const POOL_SETTINGS_MODAL_MQ = '(min-width: 1024px)'

export function shouldOpenPoolSettingsModal(): boolean {
  return window.matchMedia(POOL_SETTINGS_MODAL_MQ).matches
}

export type PoolSettingsSearchItem = {
  id: string
  name: string
  sectionId: PoolSettingsSectionId
  keywords: readonly string[]
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
