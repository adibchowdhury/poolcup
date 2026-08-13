import { renderShareCard, renderShareFallbackCard } from '@/src/lib/og/share-card'
import { verifyShareToken } from '@/src/lib/share-token'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { siteUrl } from '@/src/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ poolId: string }> }

export async function GET(request: Request, context: Ctx) {
  const { poolId } = await context.params
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')?.trim()
  const token = url.searchParams.get('t')

  if (
    !userId ||
    !verifyShareToken(token, {
      type: 'leaderboard',
      userId,
      poolId,
    })
  ) {
    return renderShareFallbackCard('Leaderboard share')
  }

  const admin = createAdminSupabaseClient()
  const { data: pool } = await admin
    .from('pools')
    .select('id, name')
    .eq('id', poolId)
    .maybeSingle()

  if (!pool) {
    return renderShareFallbackCard('Leaderboard share')
  }

  const { data: member } = await admin
    .from('pool_members')
    .select('id, display_name')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) {
    return renderShareFallbackCard('Leaderboard share')
  }

  const { count: memberCount } = await admin
    .from('pool_members')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', poolId)

  const { data: cacheRow } = await admin
    .from('leaderboard_cache')
    .select('rank, total_points')
    .eq('pool_id', poolId)
    .eq('member_id', member.id)
    .maybeSingle()

  const rank = Math.max(1, Number(cacheRow?.rank) || 1)
  const total = Math.max(1, memberCount ?? 1)
  const points = Math.max(0, Number(cacheRow?.total_points) || 0)
  // No invite_code on rank cards — invite is a separate share surface.
  const dest = siteUrl

  return renderShareCard({
    eyebrow: 'Leaderboard',
    title: `#${rank} of ${total}`,
    subtitle: `${member.display_name} in ${pool.name}`,
    footerUrl: dest,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        <div style={{ fontSize: 32, color: '#00e676', fontWeight: 700 }}>
          {points} pts
        </div>
        <div style={{ fontSize: 24, color: '#9fb2c3' }}>
          Climbing the PoolCup standings
        </div>
      </div>
    ),
  })
}
