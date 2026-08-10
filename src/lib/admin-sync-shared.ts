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
    label: 'Sync fixtures',
    path: '/api/cron/sync-fixtures',
    supportsEventId: true,
  },
  {
    jobType: 'sync_scores',
    label: 'Sync scores (live + final)',
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

export function isStaleFixtureSync(row: SyncStatusRow, nowMs = Date.now()): boolean {
  if (row.job_type !== 'sync_fixtures') return false
  const stamp =
    row.last_success_at ?? row.last_fixture_sync_at ?? row.last_finished_at
  if (!stamp) return true
  const age = nowMs - Date.parse(stamp)
  return !Number.isFinite(age) || age > 24 * 60 * 60 * 1000
}
