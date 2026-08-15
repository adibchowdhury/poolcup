import type { SupabaseClient } from '@supabase/supabase-js'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import type { SyncJobType } from '@/src/lib/sync-jobs'

/** Alert only after this many consecutive error runs for the same job_type. */
export const SYNC_SUSTAINED_FAILURE_THRESHOLD = 3

/** Re-alert at most this often while the outage continues. */
export const SYNC_FATAL_REALERT_INTERVAL_MS = 60 * 60 * 1000

type AlertStateRow = {
  job_type: string
  alerted: boolean
  last_fatal_alert_at: string | null
  consecutive_errors: number
}

/**
 * Count trailing `error` rows for a job_type (most recent first).
 * A success/partial resets the streak.
 */
export async function countConsecutiveSyncJobErrors(
  supabase: SupabaseClient,
  jobType: SyncJobType,
): Promise<number> {
  const { data, error } = await supabase
    .from('sync_jobs')
    .select('status')
    .eq('job_type', jobType)
    .order('started_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('countConsecutiveSyncJobErrors failed:', error.message)
    // Fail closed on alert: don't spam if we can't read history.
    return 0
  }

  let count = 0
  for (const row of data ?? []) {
    if (row.status === 'error') count += 1
    else break
  }
  return count
}

async function loadAlertState(
  supabase: SupabaseClient,
  jobType: SyncJobType,
): Promise<AlertStateRow | null> {
  const { data, error } = await supabase
    .from('sync_ops_alert_state')
    .select('job_type, alerted, last_fatal_alert_at, consecutive_errors')
    .eq('job_type', jobType)
    .maybeSingle()

  if (error) {
    console.error('loadAlertState failed:', error.message)
    return null
  }
  return data as AlertStateRow | null
}

async function upsertAlertState(
  supabase: SupabaseClient,
  row: {
    jobType: SyncJobType
    alerted: boolean
    lastFatalAlertAt: string | null
    consecutiveErrors: number
  },
): Promise<void> {
  const { error } = await supabase.from('sync_ops_alert_state').upsert(
    {
      job_type: row.jobType,
      alerted: row.alerted,
      last_fatal_alert_at: row.lastFatalAlertAt,
      consecutive_errors: row.consecutiveErrors,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'job_type' },
  )

  if (error) {
    console.error('upsertAlertState failed:', error.message)
  }
}

/**
 * Send a fatal ops ntfy when consecutive failures reach the threshold,
 * then re-alert at most once per hour while the streak continues.
 * Call AFTER withSyncJob has recorded the current error row.
 */
export async function notifySyncFatalIfSustained(
  supabase: SupabaseClient,
  input: {
    jobType: SyncJobType
    routeLabel: string
    message: string
  },
): Promise<void> {
  const consecutive = await countConsecutiveSyncJobErrors(
    supabase,
    input.jobType,
  )

  if (consecutive < SYNC_SUSTAINED_FAILURE_THRESHOLD) {
    console.warn(
      `${input.routeLabel}: failure recorded (${consecutive}/${SYNC_SUSTAINED_FAILURE_THRESHOLD} consecutive); suppressing ntfy:`,
      input.message,
    )
    return
  }

  const state = await loadAlertState(supabase, input.jobType)
  const now = Date.now()
  const lastAlertMs = state?.last_fatal_alert_at
    ? Date.parse(state.last_fatal_alert_at)
    : NaN
  const msSinceLastAlert = Number.isFinite(lastAlertMs)
    ? now - lastAlertMs
    : Number.POSITIVE_INFINITY

  const shouldAlert =
    !state?.alerted || msSinceLastAlert >= SYNC_FATAL_REALERT_INTERVAL_MS

  if (!shouldAlert) {
    console.warn(
      `${input.routeLabel}: sustained failure continues (${consecutive} consecutive); next ntfy in ~${Math.ceil(
        (SYNC_FATAL_REALERT_INTERVAL_MS - msSinceLastAlert) / 60_000,
      )}m:`,
      input.message,
    )
    // Keep consecutive_errors fresh for an accurate recovery message.
    await upsertAlertState(supabase, {
      jobType: input.jobType,
      alerted: true,
      lastFatalAlertAt: state?.last_fatal_alert_at ?? null,
      consecutiveErrors: consecutive,
    })
    return
  }

  await sendOpsNtfy(
    `${input.routeLabel} fatal (sustained ${consecutive}x): ${input.message}`,
  )

  await upsertAlertState(supabase, {
    jobType: input.jobType,
    alerted: true,
    lastFatalAlertAt: new Date(now).toISOString(),
    consecutiveErrors: consecutive,
  })
}

/**
 * If this job_type had an active sustained-failure alert and the run just
 * succeeded (or partial), send one recovery ntfy and clear alert state.
 * Call AFTER withSyncJob has recorded the successful/partial row.
 */
export async function notifySyncRecoveryIfNeeded(
  supabase: SupabaseClient,
  input: {
    jobType: SyncJobType
    routeLabel: string
  },
): Promise<void> {
  const state = await loadAlertState(supabase, input.jobType)
  if (!state?.alerted) return

  const failedRuns = state.consecutive_errors || SYNC_SUSTAINED_FAILURE_THRESHOLD

  await sendOpsNtfy(
    `${input.routeLabel} recovered after ${failedRuns} consecutive failures`,
  )

  await upsertAlertState(supabase, {
    jobType: input.jobType,
    alerted: false,
    lastFatalAlertAt: state.last_fatal_alert_at,
    consecutiveErrors: 0,
  })
}
