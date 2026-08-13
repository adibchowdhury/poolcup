import { renderShareCard, renderShareFallbackCard } from '@/src/lib/og/share-card'
import { isMatchLocked } from '@/src/lib/match-lock'
import { verifyShareToken } from '@/src/lib/share-token'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { siteUrl } from '@/src/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ matchId: string }> }

export async function GET(request: Request, context: Ctx) {
  const { matchId } = await context.params
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')?.trim()
  const poolId = url.searchParams.get('poolId')?.trim()
  const token = url.searchParams.get('t')

  if (
    !userId ||
    !poolId ||
    !verifyShareToken(token, {
      type: 'prediction',
      userId,
      poolId,
      matchId,
    })
  ) {
    return renderShareFallbackCard('Prediction share')
  }

  const admin = createAdminSupabaseClient()

  const { data: match } = await admin
    .from('matches')
    .select(
      'id, team1_name, team2_name, result_team1, result_team2, is_final, locked_at',
    )
    .eq('id', matchId)
    .maybeSingle()

  if (!match) {
    return renderShareFallbackCard('Prediction share')
  }

  const lockedOrFinal =
    Boolean(match.is_final) || isMatchLocked(match.locked_at ?? null)
  if (!lockedOrFinal) {
    // Never expose a pick before kickoff/lock — even the owner's own share.
    return renderShareFallbackCard('Prediction share')
  }

  const [{ data: member }, { data: pool }] = await Promise.all([
    admin
      .from('pool_members')
      .select('id, display_name')
      .eq('pool_id', poolId)
      .eq('user_id', userId)
      .maybeSingle(),
    admin.from('pools').select('id, name').eq('id', poolId).maybeSingle(),
  ])

  if (!member || !pool) {
    return renderShareFallbackCard('Prediction share')
  }

  const { data: prediction } = await admin
    .from('predictions')
    .select('pred_team1, pred_team2, points_awarded')
    .eq('pool_id', poolId)
    .eq('member_id', member.id)
    .eq('match_id', matchId)
    .maybeSingle()

  if (!prediction) {
    return renderShareFallbackCard('Prediction share')
  }

  const points = Math.max(0, Number(prediction.points_awarded) || 0)
  const predLine = `${prediction.pred_team1}–${prediction.pred_team2}`
  const resultLine =
    match.is_final && match.result_team1 != null && match.result_team2 != null
      ? `${match.result_team1}–${match.result_team2}`
      : 'TBD'
  const dest = `${siteUrl}/match/${encodeURIComponent(matchId)}`

  return renderShareCard({
    eyebrow: 'Prediction result',
    title: `${match.team1_name} vs ${match.team2_name}`,
    subtitle: `${member.display_name} in ${pool.name}`,
    footerUrl: dest,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        <div style={{ fontSize: 30, color: '#9fb2c3' }}>
          My pick {predLine} · Final {resultLine}
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, color: '#00e676' }}>
          +{points} pts
        </div>
      </div>
    ),
  })
}
