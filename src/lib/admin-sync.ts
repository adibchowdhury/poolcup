import type { SupabaseClient } from '@supabase/supabase-js'
import type { SyncStatusRow } from '@/src/lib/admin-sync-shared'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export type { SyncStatusRow, SyncJobRetryType } from '@/src/lib/admin-sync-shared'
export {
  SYNC_JOB_RETRY_TARGETS,
  isStaleFixtureSync,
} from '@/src/lib/admin-sync-shared'

export async function requireAdminUser(): Promise<{
  supabase: SupabaseClient
  userId: string
} | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (error || profile?.is_admin !== true) return null
  return { supabase, userId: user.id }
}

export async function fetchSyncStatus(
  supabase: SupabaseClient,
): Promise<{ rows: SyncStatusRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_sync_status')
  if (error) {
    return { rows: [], error: error.message }
  }
  return { rows: (data ?? []) as SyncStatusRow[], error: null }
}
