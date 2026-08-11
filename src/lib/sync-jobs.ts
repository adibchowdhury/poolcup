import type { SupabaseClient } from '@supabase/supabase-js'

export type SyncJobType =
  | 'sync_fixtures'
  | 'sync_baseball'
  | 'sync_baseball_live'
  | 'sync_american_football'
  | 'sync_american_football_live'
  | 'sync_scores'
  | 'reconcile_stale_matches'
  | 'sync_knockout_round_rows'
  | 'refresh_rosters'

export type SyncJobStatus = 'success' | 'error' | 'partial'

/**
 * Durable ingestion log for public.sync_jobs.
 * Writes one row per completed run (success / partial / error).
 */
export async function recordSyncJob(
  supabase: SupabaseClient,
  input: {
    jobType: SyncJobType
    eventId?: string | null
    status: SyncJobStatus
    startedAt: string
    itemsProcessed?: number
    itemsChanged?: number
    errorMessage?: string | null
    detail?: Record<string, unknown>
  },
): Promise<void> {
  try {
    const { error } = await supabase.from('sync_jobs').insert({
      job_type: input.jobType,
      event_id: input.eventId ?? null,
      status: input.status,
      started_at: input.startedAt,
      finished_at: new Date().toISOString(),
      items_processed: input.itemsProcessed ?? 0,
      items_changed: input.itemsChanged ?? 0,
      error_message: input.errorMessage ?? null,
      detail: input.detail ?? {},
    })

    if (error) {
      console.error('sync_jobs insert failed:', error.message)
    }
  } catch (err) {
    console.error('sync_jobs insert threw:', err)
  }
}

/**
 * Run work and always record a sync_jobs row.
 */
export async function withSyncJob<T>(
  supabase: SupabaseClient,
  input: {
    jobType: SyncJobType
    eventId?: string | null
    detail?: Record<string, unknown>
  },
  work: () => Promise<{
    itemsProcessed?: number
    itemsChanged?: number
    detail?: Record<string, unknown>
    partial?: boolean
    result: T
  }>,
): Promise<T> {
  const startedAt = new Date().toISOString()
  try {
    const out = await work()
    await recordSyncJob(supabase, {
      jobType: input.jobType,
      eventId: input.eventId,
      status: out.partial ? 'partial' : 'success',
      startedAt,
      itemsProcessed: out.itemsProcessed,
      itemsChanged: out.itemsChanged,
      detail: { ...(input.detail ?? {}), ...(out.detail ?? {}) },
    })
    return out.result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await recordSyncJob(supabase, {
      jobType: input.jobType,
      eventId: input.eventId,
      status: 'error',
      startedAt,
      errorMessage: message,
      detail: { ...(input.detail ?? {}), thrown: message },
    })
    throw err
  }
}
