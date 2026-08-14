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
    .select('id, name, theme_color, emblem_url')
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

  const { data: banRow } = await admin
    .from('users')
    .select('banned')
    .eq('id', userId)
    .maybeSingle()

  if (banRow?.banned === true) {
    return renderShareFallbackCard('Leaderboard share')
  }

  const { data: allMembers } = await admin
    .from('pool_members')
    .select('id, user_id')
    .eq('pool_id', poolId)

  const memberUserIds = (allMembers ?? [])
    .map((row) => row.user_id)
    .filter((id): id is string => typeof id === 'string')

  const { data: bannedRows } = await admin
    .from('users')
    .select('id')
    .in('id', memberUserIds.length > 0 ? memberUserIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('banned', true)

  const bannedIds = new Set((bannedRows ?? []).map((row) => String(row.id)))
  const activeMemberCount = (allMembers ?? []).filter(
    (row) => !bannedIds.has(String(row.user_id)),
  ).length

  const { data: cacheRows } = await admin
    .from('leaderboard_cache')
    .select('rank, total_points, member_id')
    .eq('pool_id', poolId)
    .order('rank', { ascending: true })

  const activeMemberIdSet = new Set(
    (allMembers ?? [])
      .filter((row) => !bannedIds.has(String(row.user_id)))
      .map((row) => String(row.id)),
  )
  const densified = (cacheRows ?? [])
    .filter((row) => activeMemberIdSet.has(String(row.member_id)))
    .map((row, index) => ({
      member_id: String(row.member_id),
      rank: index + 1,
      total_points: row.total_points,
    }))
  const cacheRow = densified.find((row) => row.member_id === member.id)

  const rank = Math.max(1, Number(cacheRow?.rank) || 1)
  const total = Math.max(1, activeMemberCount || 1)
  const points = Math.max(0, Number(cacheRow?.total_points) || 0)
  // No invite_code on rank cards — invite is a separate share surface.
  const dest = siteUrl
  const accent =
    typeof pool.theme_color === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(pool.theme_color.trim())
      ? pool.theme_color.trim().toLowerCase()
      : '#00e676'
  const emblemUrl =
    typeof pool.emblem_url === 'string' &&
    /^https?:\/\//i.test(pool.emblem_url.trim())
      ? pool.emblem_url.trim()
      : null

  return renderShareCard({
    eyebrow: 'Leaderboard',
    title: `#${rank} of ${total}`,
    subtitle: `${member.display_name} in ${pool.name}`,
    footerUrl: dest,
    accent,
    emblemUrl,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        <div style={{ fontSize: 32, color: accent, fontWeight: 700 }}>
          {points} pts
        </div>
        <div style={{ fontSize: 24, color: '#9fb2c3' }}>
          Climbing the PoolCup standings
        </div>
      </div>
    ),
  })
}
