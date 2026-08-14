export type AdminMetrics = {
  total_users: number
  dau: number
  predictions_today: number
  pools_created_today: number
  subs_free: number
  subs_pro: number
  subs_commissioner: number
  mrr_estimate: number
  total_pools: number
  total_predictions: number
  banned_users: number
}

export type AdminUserLookupRow = {
  id: string
  username: string | null
  display_name: string | null
  email: string | null
  tier: string | null
  banned: boolean | null
  created_at: string | null
  last_active_at: string | null
}

export type AdminUserDetail = {
  profile: {
    id: string
    username: string | null
    display_name: string | null
    email: string | null
    tier: string | null
    subscription_status: string | null
    stripe_customer_id: string | null
    banned: boolean | null
    is_admin: boolean | null
    created_at: string | null
    last_active_at: string | null
    points: number | null
    is_supporter: boolean | null
  } | null
  pools_owned: Array<{
    id: string
    name: string | null
    created_at: string | null
  }>
  pools_joined_count: number
  recent_predictions: Array<{
    match_id: string
    pred: string
    points: number | null
    submitted_at: string | null
  }>
}

export type AdminPoolLookupRow = {
  id: string
  name: string | null
  invite_code: string | null
  creator_id: string | null
  creator_name: string | null
  member_count: number | null
  created_at: string | null
}

export type AdminPoolDetail = {
  pool: {
    id: string
    name: string | null
    invite_code: string | null
    creator_id: string | null
    is_public: boolean | null
    created_at: string | null
    scoring_style: string | null
    event_id: string | null
  } | null
  owner: {
    id: string
    display_name: string | null
    email: string | null
    tier: string | null
  } | null
  member_count: number
  co_commissioners: number
}

export type AdminMatchLookupRow = {
  id: string
  team1_name: string | null
  team2_name: string | null
  result_team1: number | null
  result_team2: number | null
  is_final: boolean | null
  kickoff_at: string | null
}

export type AdminFailedWebhookRow = {
  stripe_event_id: string
  event_type: string | null
  status: string | null
  error: string | null
  created_at: string | null
}

export type AdminAuditLogRow = {
  id: string
  admin_id: string | null
  admin_name: string | null
  action: string
  target_type: string | null
  target_id: string | null
  detail: unknown
  created_at: string | null
}

export const ADMIN_NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/pools', label: 'Pools' },
  { href: '/admin/matches', label: 'Matches' },
  { href: '/admin/sync', label: 'Ingestion' },
  { href: '/admin/badges', label: 'Badges' },
  { href: '/admin/referrals', label: 'Referrals' },
  { href: '/admin/webhooks', label: 'Webhooks' },
  { href: '/admin/audit', label: 'Audit log' },
] as const
