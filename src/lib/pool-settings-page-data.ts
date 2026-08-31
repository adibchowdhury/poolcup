import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import { fetchPoolHasCommissionerTools } from '@/src/lib/commissioner-entitlements'
import {
  fetchPoolCommissionerRole,
  listCoCommissioners,
} from '@/src/lib/pool-admin'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export type PoolSettingsPageData = {
  inviteCode: string
  poolId: string
  /** pools.created_at — sidebar Kickoff row on desktop shell. */
  createdAt: string | null
  poolName: string
  poolDescription: string | null
  poolThemeColor: string | null
  poolAvatar: string | null
  poolEmblemUrl: string | null
  scoringStyle: string
  scoreExactPoints: number | null
  scoreWinnerPoints: number | null
  scoreDrawPoints: number | null
  scoringLocked: boolean
  acceptingMembers: boolean
  isPublic: boolean
  members: LeaderboardMember[]
  poolCreatorUserId: string
  currentUserId: string
  isAdmin: boolean
  isOwner: boolean
  poolHasCommissionerTools: boolean
  coAdminUserIds: string[]
}

export type PoolSettingsPageLoadResult =
  | { kind: 'unauthenticated'; loginNext: string }
  | { kind: 'join'; inviteCode: string }
  | { kind: 'ok'; data: PoolSettingsPageData }

type PoolSettingsAccessOk = {
  kind: 'ok'
  userId: string
  pool: PoolRow
}

export type PoolSettingsAccessResult =
  | { kind: 'unauthenticated'; loginNext: string }
  | { kind: 'join'; inviteCode: string }
  | PoolSettingsAccessOk

type PoolRow = {
  id: string
  name: string
  description: string | null
  invite_code: string
  creator_id: string
  created_at: string | null
  scoring_style: string
  accepting_members: boolean | null
  is_public: boolean | null
  avatar: string | null
  emblem_url: string | null
  theme_color: string | null
  event_id: string | null
  score_exact_points: number | null
  score_winner_points: number | null
  score_draw_points: number | null
  scoring_locked_at: string | null
}

type MemberRow = {
  id: string
  user_id: string
  display_name: string
}

type AvatarRow = {
  member_id: string
  avatar: string | null
  custom_avatar_url: string | null
}

type CacheRow = {
  rank: number
  member_id: string
  total_points: number | null
  exact_scores: number | null
}

/**
 * Membership-only gate (auth + pool + member row). Does not load roster,
 * scoring, or commissioner extras — safe to run behind Suspense while the
 * hub shell paints.
 */
export async function assertPoolSettingsAccess(
  inviteCodeRaw: string,
  settingsPath: string,
): Promise<PoolSettingsAccessResult> {
  const inviteCode = inviteCodeRaw.trim()
  if (!inviteCode) {
    return { kind: 'join', inviteCode: inviteCodeRaw }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      kind: 'unauthenticated',
      loginNext: `/login?next=${encodeURIComponent(settingsPath)}`,
    }
  }

  const admin = createAdminSupabaseClient()
  const { data: poolData } = await admin
    .from('pools')
    .select(
      'id, name, description, invite_code, creator_id, created_at, scoring_style, accepting_members, is_public, avatar, emblem_url, theme_color, event_id, score_exact_points, score_winner_points, score_draw_points, scoring_locked_at',
    )
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (!poolData) {
    return { kind: 'join', inviteCode }
  }

  const pool = poolData as PoolRow

  const { data: membership } = await admin
    .from('pool_members')
    .select('id')
    .eq('pool_id', pool.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return { kind: 'join', inviteCode }
  }

  return { kind: 'ok', userId: user.id, pool }
}

/**
 * Server-load pool settings for a member. Non-members are sent to join
 * (same access as the pool page). Admin/owner flags are server-checked here
 * for UI gates; mutating APIs still re-check.
 */
export async function loadPoolSettingsPageData(
  inviteCodeRaw: string,
  settingsPath: string,
): Promise<PoolSettingsPageLoadResult> {
  const access = await assertPoolSettingsAccess(inviteCodeRaw, settingsPath)
  if (access.kind !== 'ok') return access

  const { pool, userId } = access
  const admin = createAdminSupabaseClient()

  const [
    role,
    poolHasCommissionerTools,
    coCommissioners,
    membersResult,
    avatarResult,
    cacheResult,
    matchesPlayedResult,
    awardedResult,
  ] = await Promise.all([
    fetchPoolCommissionerRole(admin, pool.id, userId),
    fetchPoolHasCommissionerTools(admin, pool.id),
    listCoCommissioners(admin, pool.id),
    admin
      .from('pool_members')
      .select('id, user_id, display_name, joined_at')
      .eq('pool_id', pool.id)
      .order('joined_at', { ascending: true }),
    admin.rpc('get_pool_member_avatars', { p_pool_id: pool.id }),
    admin
      .from('leaderboard_cache')
      .select('rank, member_id, total_points, exact_scores')
      .eq('pool_id', pool.id),
    (() => {
      let query = admin
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('is_final', true)
      if (pool.event_id) query = query.eq('event_id', pool.event_id)
      return query
    })(),
    admin
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', pool.id)
      .neq('points_awarded', 0),
  ])

  const avatarByMemberId = new Map<
    string,
    { avatar: string | null; customAvatarUrl: string | null }
  >()
  for (const row of (avatarResult.data ?? []) as AvatarRow[]) {
    avatarByMemberId.set(String(row.member_id), {
      avatar: row.avatar ?? null,
      customAvatarUrl: row.custom_avatar_url ?? null,
    })
  }

  const cacheByMemberId = new Map<string, CacheRow>()
  for (const row of (cacheResult.data ?? []) as CacheRow[]) {
    cacheByMemberId.set(String(row.member_id), row)
  }

  const memberRows = (membersResult.data ?? []) as MemberRow[]
  const members: LeaderboardMember[] = memberRows.map((member, index) => {
    const cache = cacheByMemberId.get(member.id)
    const avatar = avatarByMemberId.get(member.id)
    const rank = cache?.rank && cache.rank > 0 ? cache.rank : index + 1
    const points = cache?.total_points ?? 0
    const exactScores = cache?.exact_scores ?? 0
    return {
      id: member.id,
      userId: member.user_id,
      name: member.display_name,
      isYou: member.user_id === userId,
      avatar: avatar?.avatar ?? null,
      customAvatarUrl: avatar?.customAvatarUrl ?? null,
      points,
      correctPredictions: 0,
      exactScores,
      totalPredictions: 0,
      rank,
      prevRank: null,
      rankDelta: 0,
      movement: 'none' as const,
      climbStreak: 0,
      streak: 0,
    }
  })

  const matchesPlayedCount = matchesPlayedResult.count ?? 0
  const hasAwardedPoints = (awardedResult.count ?? 0) > 0
  const scoringLocked =
    Boolean(pool.scoring_locked_at) || hasAwardedPoints || matchesPlayedCount > 0

  return {
    kind: 'ok',
    data: {
      inviteCode: pool.invite_code,
      poolId: pool.id,
      createdAt: pool.created_at ?? null,
      poolName: pool.name,
      poolDescription:
        typeof pool.description === 'string' ? pool.description : null,
      poolThemeColor: pool.theme_color ?? null,
      poolAvatar: pool.avatar ?? null,
      poolEmblemUrl: pool.emblem_url ?? null,
      scoringStyle: pool.scoring_style,
      scoreExactPoints: pool.score_exact_points ?? null,
      scoreWinnerPoints: pool.score_winner_points ?? null,
      scoreDrawPoints: pool.score_draw_points ?? null,
      scoringLocked,
      acceptingMembers: pool.accepting_members ?? true,
      isPublic: pool.is_public === true,
      members,
      poolCreatorUserId: pool.creator_id,
      currentUserId: userId,
      isAdmin: role.isAdmin,
      isOwner: role.isOwner,
      poolHasCommissionerTools,
      coAdminUserIds: coCommissioners.map((row) => row.userId),
    },
  }
}
