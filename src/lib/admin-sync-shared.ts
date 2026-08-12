export type SyncStatusRow = {
  job_type: string
  event_id: string | null
  event_name: string | null
  last_status: string | null
  last_started_at: string | null
  last_finished_at: string | null
  last_success_at: string | null
  last_error_message: string | null
  items_processed: number | null
  items_changed: number | null
  last_fixture_sync_at?: string | null
  last_fixture_sync_status?: string | null
}

export const SYNC_JOB_RETRY_TARGETS = [
  {
    jobType: 'sync_fixtures',
    label: 'Sync fixtures (soccer)',
    path: '/api/cron/sync-fixtures',
    supportsEventId: true,
  },
  {
    jobType: 'sync_baseball',
    label: 'Sync baseball (season)',
    path: '/api/cron/sync-baseball',
    supportsEventId: true,
  },
  {
    jobType: 'sync_baseball_live',
    label: 'Sync baseball (live scores)',
    path: '/api/cron/sync-baseball-live',
    supportsEventId: false,
  },
  {
    jobType: 'sync_american_football',
    label: 'Sync NFL / american football (season)',
    path: '/api/cron/sync-american-football',
    supportsEventId: true,
  },
  {
    jobType: 'sync_american_football_live',
    label: 'Sync NFL / american football (live scores)',
    path: '/api/cron/sync-american-football-live',
    supportsEventId: false,
  },
  {
    jobType: 'sync_basketball',
    label: 'Sync basketball / NBA (season)',
    path: '/api/cron/sync-basketball',
    supportsEventId: true,
  },
  {
    jobType: 'sync_basketball_live',
    label: 'Sync basketball / NBA (live scores)',
    path: '/api/cron/sync-basketball-live',
    supportsEventId: false,
  },
  {
    jobType: 'sync_hockey',
    label: 'Sync hockey / NHL (season)',
    path: '/api/cron/sync-hockey',
    supportsEventId: true,
  },
  {
    jobType: 'sync_hockey_live',
    label: 'Sync hockey / NHL (live scores)',
    path: '/api/cron/sync-hockey-live',
    supportsEventId: false,
  },
  {
    jobType: 'sync_scores',
    label: 'Sync scores (soccer live + final)',
    path: '/api/sync-scores',
    supportsEventId: false,
  },
  {
    jobType: 'reconcile_stale_matches',
    label: 'Reconcile stale matches',
    path: '/api/reconcile-stale-matches',
    supportsEventId: false,
  },
  {
    jobType: 'sync_knockout_round_rows',
    label: 'Sync knockout round rows',
    path: '/api/sync-knockout-round-rows',
    supportsEventId: false,
  },
  {
    jobType: 'refresh_rosters',
    label: 'Refresh team rosters',
    path: '/api/cron/refresh-rosters',
    supportsEventId: false,
  },
] as const

export type SyncJobRetryType = (typeof SYNC_JOB_RETRY_TARGETS)[number]['jobType']

export type SyncJobRetryTarget = {
  jobType: string
  label: string
  path: string
  supportsEventId: boolean
}

const RETRY_TARGET_BY_TYPE = new Map<string, SyncJobRetryTarget>(
  SYNC_JOB_RETRY_TARGETS.map((t) => [t.jobType, t]),
)

export function getSyncJobRetryTarget(
  jobType: string,
): SyncJobRetryTarget | undefined {
  return RETRY_TARGET_BY_TYPE.get(jobType)
}

/** Humanize unknown job_type keys for the admin dashboard. */
export function formatSyncJobTypeLabel(jobType: string): string {
  const known = RETRY_TARGET_BY_TYPE.get(jobType)
  if (known) return known.label
  return jobType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Ordered section keys: known retry targets first (stable order), then any
 * extra job types returned by get_sync_status (future sports / ad-hoc jobs).
 */
export function orderSyncJobTypesForDisplay(
  jobTypesFromStatus: Iterable<string>,
): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []

  for (const target of SYNC_JOB_RETRY_TARGETS) {
    seen.add(target.jobType)
    ordered.push(target.jobType)
  }

  const extras = [...jobTypesFromStatus]
    .filter((t) => t && !seen.has(t))
    .sort((a, b) => a.localeCompare(b))

  for (const extra of extras) {
    ordered.push(extra)
  }

  return ordered
}

export function isStaleFixtureSync(row: SyncStatusRow, nowMs = Date.now()): boolean {
  if (
    row.job_type !== 'sync_fixtures' &&
    row.job_type !== 'sync_baseball' &&
    row.job_type !== 'sync_american_football' &&
    row.job_type !== 'sync_basketball' &&
    row.job_type !== 'sync_hockey'
  ) {
    return false
  }
  const stamp =
    row.last_success_at ?? row.last_fixture_sync_at ?? row.last_finished_at
  if (!stamp) return true
  const age = nowMs - Date.parse(stamp)
  return !Number.isFinite(age) || age > 24 * 60 * 60 * 1000
}
