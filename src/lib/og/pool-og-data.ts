import { unstable_cache } from 'next/cache'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { normalizePoolThemeColor } from '@/src/lib/pool-theme'

export type PoolOgData = {
  id: string
  name: string
  inviteCode: string
  eventName: string | null
  memberCount: number
  scoringStyle: string | null
  /** Normalized #rrggbb or null (caller falls back to default accent). */
  themeColor: string | null
  /** Public emblem URL when set. */
  emblemUrl: string | null
}

async function fetchPoolOgDataUncached(
  inviteCode: string,
): Promise<PoolOgData | null> {
  const code = inviteCode?.trim()
  if (!code) return null

  try {
    const admin = createAdminSupabaseClient()
    const { data: pool } = await admin
      .from('pools')
      .select(
        'id, name, invite_code, event_id, scoring_style, event_name, theme_color, emblem_url',
      )
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

    const emblemRaw =
      typeof pool.emblem_url === 'string' ? pool.emblem_url.trim() : ''
    const emblemUrl =
      emblemRaw && /^https?:\/\//i.test(emblemRaw) ? emblemRaw : null

    return {
      id: pool.id as string,
      name: String(pool.name ?? 'Pool'),
      inviteCode: String(pool.invite_code ?? code),
      eventName,
      memberCount: Math.max(0, count ?? 0),
      scoringStyle:
        typeof pool.scoring_style === 'string' ? pool.scoring_style : null,
      themeColor: normalizePoolThemeColor(
        typeof pool.theme_color === 'string' ? pool.theme_color : null,
      ),
      emblemUrl,
    }
  } catch {
    return null
  }
}

/** Cached so client navigations back to the pool page are not blocked on OG DB. */
export const fetchPoolOgData = unstable_cache(
  fetchPoolOgDataUncached,
  ['pool-og-data'],
  { revalidate: 120 },
)
