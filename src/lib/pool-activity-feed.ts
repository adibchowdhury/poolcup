import { supabase } from '@/src/lib/supabase'

export type PoolActivitySubjectType = 'group' | 'third_place' | 'match'

export type PoolActivityPointsReason =
  | 'exact_score'
  | 'correct_winner'
  | 'winner_group'
  | 'third_place'

export type PoolActivityFeedItem = {
  id: string
  type: string
  subjectType: PoolActivitySubjectType | null
  groupName: string | null
  matchId: string | null
  areaLabel: string
  matchContext: string | null
  points: number | null
  reason: string | null
  createdAt: string
  memberId: string
  actorUserId: string
  displayName: string
  avatar: string | null
}

const POINTS_REASON_LABELS: Record<PoolActivityPointsReason, string> = {
  exact_score: 'nailed the exact score',
  correct_winner: 'called the winner',
  winner_group: 'called the group standings',
  third_place: 'called the third-place qualifiers',
}

const MATCH_ROUND_LABELS: Record<string, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
}

type MatchLabelRow = {
  id: string
  team1_name: string
  team2_name: string
  round: string
}

type PoolActivityQueryRow = {
  id: string
  type: string
  subject_type: string | null
  group_name: string | null
  match_id: string | null
  points: number | null
  reason: string | null
  created_at: string
  member_id: string
  pool_members:
    | {
        display_name: string
        user_id: string
      }
    | {
        display_name: string
        user_id: string
      }[]
    | null
}

function formatMatchMatchup(match: MatchLabelRow): string {
  return `${match.team1_name} vs ${match.team2_name}`
}

function formatMatchAreaLabel(match: MatchLabelRow): string {
  const matchup = formatMatchMatchup(match)
  const roundLabel = MATCH_ROUND_LABELS[match.round]
  return roundLabel ? `${roundLabel}: ${matchup}` : matchup
}

export function buildPoolActivityAreaLabel(
  subjectType: PoolActivitySubjectType | null,
  groupName: string | null,
  matchId: string | null,
  matchLabels: Map<string, MatchLabelRow>,
): string {
  if (subjectType === 'group' && groupName) {
    return `Group ${groupName}`
  }

  if (subjectType === 'third_place') {
    return 'the best third-place teams'
  }

  if (subjectType === 'match' && matchId) {
    const match = matchLabels.get(matchId)
    if (match) {
      return formatMatchAreaLabel(match)
    }
    return 'a match'
  }

  return 'predictions'
}

export function getPoolActivityMessage(
  activity: PoolActivityFeedItem,
  currentUserId: string,
): { actor: string; action: string } {
  const isYou = activity.actorUserId === currentUserId
  const actor = isYou ? 'You' : activity.displayName
  const label = activity.areaLabel
  const isCreated = activity.type === 'predictions_created'

  if (isYou) {
    return {
      actor,
      action: isCreated ? `predicted ${label}` : `updated your ${label} prediction`,
    }
  }

  return {
    actor,
    action: isCreated ? `predicted ${label}` : `updated their ${label} prediction`,
  }
}

export function getPointsEarnedReasonLabel(reason: string): string {
  const label = POINTS_REASON_LABELS[reason as PoolActivityPointsReason]
  if (label) return label
  return reason.replace(/_/g, ' ')
}

export function buildPointsEarnedContext(activity: PoolActivityFeedItem): string {
  if (activity.subjectType === 'match' && activity.matchContext) {
    return activity.matchContext
  }

  if (activity.subjectType === 'group' && activity.groupName) {
    return `Group ${activity.groupName}`
  }

  if (activity.subjectType === 'third_place') {
    return 'the best third-place teams'
  }

  return activity.areaLabel
}

export function getPoolActivityPointsEarnedMessage(
  activity: PoolActivityFeedItem,
  currentUserId: string,
): { actor: string; points: number; reasonLabel: string; context: string } {
  const isYou = activity.actorUserId === currentUserId
  const actor = isYou ? 'You' : activity.displayName
  const points = Math.max(0, activity.points ?? 0)
  const reasonLabel = getPointsEarnedReasonLabel(activity.reason ?? '')
  const context = buildPointsEarnedContext(activity)

  return { actor, points, reasonLabel, context }
}

export async function fetchPoolActivityFeed(
  poolId: string,
): Promise<{ items: PoolActivityFeedItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('pool_activity')
    .select(
      `
      id,
      type,
      subject_type,
      group_name,
      match_id,
      points,
      reason,
      created_at,
      member_id,
      pool_members (
        display_name,
        user_id
      )
    `,
    )
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })

  if (error) {
    return { items: [], error: error.message }
  }

  const rows = (data ?? []) as PoolActivityQueryRow[]
  const matchIds = [
    ...new Set(
      rows
        .map((row) => row.match_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const matchLabels = new Map<string, MatchLabelRow>()
  if (matchIds.length > 0) {
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select('id, team1_name, team2_name, round')
      .in('id', matchIds)

    if (matchesError) {
      console.error('Failed to load activity match labels:', matchesError.message)
    } else {
      for (const match of (matchesData ?? []) as MatchLabelRow[]) {
        matchLabels.set(match.id, match)
      }
    }
  }

  const userIds = [
    ...new Set(
      rows
        .map((row) => {
          const member = Array.isArray(row.pool_members)
            ? row.pool_members[0]
            : row.pool_members
          return member?.user_id
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const avatarByUserId = new Map<string, string | null>()
  if (userIds.length > 0) {
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, avatar')
      .in('id', userIds)

    if (usersError) {
      console.error('Failed to load activity avatars:', usersError.message)
    } else {
      for (const user of usersData ?? []) {
        avatarByUserId.set(user.id, user.avatar ?? null)
      }
    }
  }

  const items: PoolActivityFeedItem[] = rows.map((row) => {
    const member = Array.isArray(row.pool_members)
      ? row.pool_members[0]
      : row.pool_members
    const actorUserId = member?.user_id ?? ''
    const subjectType = row.subject_type as PoolActivitySubjectType | null
    const match =
      row.match_id != null ? matchLabels.get(row.match_id) : undefined

    return {
      id: row.id,
      type: row.type,
      subjectType,
      groupName: row.group_name,
      matchId: row.match_id,
      areaLabel: buildPoolActivityAreaLabel(
        subjectType,
        row.group_name,
        row.match_id,
        matchLabels,
      ),
      matchContext: match ? formatMatchMatchup(match) : null,
      points: row.points,
      reason: row.reason,
      createdAt: row.created_at,
      memberId: row.member_id,
      actorUserId,
      displayName: member?.display_name?.trim() || 'Member',
      avatar: avatarByUserId.get(actorUserId) ?? null,
    }
  })

  return { items, error: null }
}
