import type { SupabaseClient } from '@supabase/supabase-js'
import type { PointsTransactionRow } from '@/src/lib/points-transaction-feed'

/** Same query as components/dashboard/points-history-feed.tsx */
export async function fetchPointsTransactions(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ transactions: PointsTransactionRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('points_transactions')
    .select('id, reason, points, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return { transactions: [], error: error.message }
  }

  return { transactions: (data ?? []) as PointsTransactionRow[], error: null }
}

export type UserProfileRow = {
  display_name: string | null
  avatar: string | null
}

export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ profile: UserProfileRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('users')
    .select('display_name, avatar')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return { profile: null, error: error.message }
  }

  return { profile: (data ?? null) as UserProfileRow | null, error: null }
}
