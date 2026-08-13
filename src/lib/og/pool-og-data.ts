import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export type PoolOgData = {
  id: string
  name: string
  inviteCode: string
  eventName: string | null
  memberCount: number
  scoringStyle: string | null
}

export async function fetchPoolOgData(
  inviteCode: string,
): Promise<PoolOgData | null> {
  const code = inviteCode?.trim()
  if (!code) return null

  try {
    const admin = createAdminSupabaseClient()
    const { data: pool } = await admin
      .from('pools')
      .select('id, name, invite_code, event_id, scoring_style, event_name')
      .eq('invite_code', code)
      .maybeSingle()

    if (!pool) return null

    const { count } = await admin
      .from('pool_members')
      .select('id', { count: 'exact', head: true })
      .eq('pool_id', pool.id)

    let eventName =
      typeof pool.event_name === 'string' && pool.event_name.trim()
        ? pool.event_name.trim()
        : null

    if (!eventName && pool.event_id) {
      const { data: event } = await admin
        .from('sporting_events')
        .select('name')
        .eq('id', pool.event_id)
        .maybeSingle()
      eventName = event?.name?.trim() || null
    }

    return {
      id: pool.id as string,
      name: String(pool.name ?? 'Pool'),
      inviteCode: String(pool.invite_code ?? code),
      eventName,
      memberCount: Math.max(0, count ?? 0),
      scoringStyle:
        typeof pool.scoring_style === 'string' ? pool.scoring_style : null,
    }
  } catch {
    return null
  }
}
