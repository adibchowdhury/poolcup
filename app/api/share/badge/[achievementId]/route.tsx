import { renderShareCard } from '@/src/lib/og/share-card'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { siteUrl } from '@/src/lib/site'
import { achievementRarityLabel } from '@/src/lib/achievement-rarity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ achievementId: string }> }

export async function GET(request: Request, context: Ctx) {
  const { achievementId } = await context.params
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')?.trim() || null

  const admin = createAdminSupabaseClient()
  const { data: achievement } = await admin
    .from('achievements')
    .select('id, name, rarity, xp_value')
    .eq('id', achievementId)
    .maybeSingle()

  if (!achievement) {
    return renderShareCard({
      eyebrow: 'PoolCup',
      title: 'Badge',
      subtitle: 'Earn achievements on PoolCup',
      footerUrl: `${siteUrl}/achievements`,
    })
  }

  let attributedUserId: string | null = null
  let who: string | null = null

  if (userId) {
    const { data: earned } = await admin
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)
      .eq('achievement_id', achievementId)
      .maybeSingle()

    if (earned) {
      const { data: user } = await admin
        .from('users')
        .select('display_name, username')
        .eq('id', userId)
        .maybeSingle()
      who =
        user?.display_name?.trim() ||
        user?.username?.trim() ||
        null
      attributedUserId = userId
    }
  }

  const rarity = achievement.rarity
    ? achievementRarityLabel(String(achievement.rarity))
    : null
  const dest = attributedUserId
    ? `${siteUrl}/u/${encodeURIComponent(attributedUserId)}`
    : `${siteUrl}/achievements`

  return renderShareCard({
    eyebrow: rarity ? `${rarity} badge` : 'Badge',
    title: String(achievement.name),
    subtitle: who
      ? `${who} earned this on PoolCup`
      : 'Earn this badge on PoolCup',
    footerUrl: dest,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        {achievement.xp_value ? (
          <div style={{ fontSize: 28, color: '#00e676', fontWeight: 700 }}>
            +{achievement.xp_value} XP
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            padding: '14px 24px',
            borderRadius: 999,
            border: '1px solid #1e2d3d',
            color: '#9fb2c3',
            fontSize: 22,
            width: 'fit-content',
          }}
        >
          {who ? 'I earned this on PoolCup' : 'Unlock on PoolCup'}
        </div>
      </div>
    ),
  })
}
