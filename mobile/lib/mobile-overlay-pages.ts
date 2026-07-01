export type MobileOverlayPageId =
  | 'support-us'
  | 'settings'
  | 'help'
  | 'contact'
  | 'invite-friends'
  | 'leaderboard'
  | 'account-security'
  | 'report-issue'

export const MOBILE_OVERLAY_PAGE_TITLES: Record<MobileOverlayPageId, string> =
  {
    'support-us': 'Support us',
    settings: 'Settings',
    help: 'Help',
    contact: 'Contact',
    'invite-friends': 'Invite friends',
    leaderboard: 'Leaderboard',
    'account-security': 'Account & security',
    'report-issue': 'Report an issue',
  }

export const SUPPORT_EMAIL = 'support@getpoolcup.com'
