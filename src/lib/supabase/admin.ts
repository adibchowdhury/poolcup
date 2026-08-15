import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client with the service role key. Bypasses RLS.
 * Use only in server-side API routes — never import in client components.
 *
 * Uses the project REST URL (PostgREST via Supabase's pooler gateway).
 * Clients are created per invocation and do not hold idle DB sockets —
 * each query is an HTTP request that releases when complete.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
