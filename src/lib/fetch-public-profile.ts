import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ACHIEVEMENT_SELECT,
  buildAchievementsData,
  type AchievementCatalogueRow,
  type UserAchievementsData,
} from '@/src/lib/fetch-user-achievements'
import { xpToLevel } from '@/src/lib/levels'
import { fetchUserXpTotal } from '@/src/lib/xp'
import { ONBOARDING_SPORT_OPTIONS } from '@/src/lib/onboarding'

export type PublicProfile = {
  id: string
  display_name: string | null
  username: string | null
  avatar: string | null
  custom_avatar_url: string | null
  is_supporter: boolean
  created_at: string
  total_xp: number
  badges_earned: number
  predictions_made: number
  accuracy: number | null
  favorite_sports: string[] | null
  exact_scores: number | null
  points_total: number | null
  consecutive_correct: number | null
  friends_count: number | null
  highest_level: number | null
}

export type PublicProfileCareer = {
  predictionsMade: number
  accuracy: number | null
  exactScores: number
  totalPoints: number
}

export type FavoriteSportChip = {
  id: string
  label: string
  ballSrc: string | null
}

type UserAchievementRow = {
  achievement_id: string
  earned_at: string
}

function emptyAchievements(error: string | null = null): UserAchievementsData {
  return {
    achievements: [],
    groups: [],
    totalXp: 0,
    earnedCount: 0,
    totalCount: 0,
    level: xpToLevel(0),
    recentlyUnlocked: [],
    newlyAwardedIds: [],
    error,
    evalXpAwarded: 0,
    evalLevelBefore: null,
    evalLevelAfter: null,
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function coercePublicProfile(raw: unknown): PublicProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : null
  if (!id) return null

  const accuracyRaw = row.accuracy
  const accuracy =
    accuracyRaw == null || accuracyRaw === ''
      ? null
      : Math.round(Number(accuracyRaw))

  const favoriteRaw = row.favorite_sports
  const favorite_sports = Array.isArray(favoriteRaw)
    ? favoriteRaw.filter((s): s is string => typeof s === 'string')
    : null

  return {
    id,
    display_name:
      typeof row.display_name === 'string' ? row.display_name : null,
    username: typeof row.username === 'string' ? row.username : null,
    avatar: typeof row.avatar === 'string' ? row.avatar : null,
    custom_avatar_url:
      typeof row.custom_avatar_url === 'string'
        ? row.custom_avatar_url
        : null,
    is_supporter: Boolean(row.is_supporter),
    created_at:
      typeof row.created_at === 'string' ? row.created_at : '',
    total_xp: Math.max(0, Number(row.total_xp) || 0),
    badges_earned: Math.max(0, Number(row.badges_earned) || 0),
    predictions_made: Math.max(0, Number(row.predictions_made) || 0),
    accuracy:
      accuracy == null || Number.isNaN(accuracy) ? null : accuracy,
    favorite_sports,
    exact_scores: asNumber(row.exact_scores),
    points_total: asNumber(row.points_total ?? row.total_points ?? row.points),
    consecutive_correct: asNumber(row.consecutive_correct),
    friends_count: asNumber(row.friends_count),
    highest_level: asNumber(row.highest_level),
  }
}

/**
 * Safe public profile via SECURITY DEFINER RPC `get_public_profile`.
 * Returns public fields only (includes username, favorites, friends_count,
 * points, exact_scores). Excludes banned users. Never email / private UX.
 */
export async function fetchPublicProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<PublicProfile | null> {
  if (!userId) return null

  const { data, error } = await supabase.rpc('get_public_profile', {
    p_user_id: userId,
  })

  if (error) {
    console.error('get_public_profile failed:', error.message)
    return null
  }

  const profile = Array.isArray(data)
    ? coercePublicProfile(data[0] ?? null)
    : coercePublicProfile(data)
  if (!profile) return null

  const [ledgerXp, highestRes] = await Promise.all([
    fetchUserXpTotal(supabase, userId),
    supabase
      .from('users')
      .select('highest_level')
      .eq('id', userId)
      .maybeSingle(),
  ])

  return {
    ...profile,
    total_xp: ledgerXp,
    highest_level:
      asNumber(highestRes.data?.highest_level) ?? profile.highest_level,
  }
}

/** Map achievement progress metrics → career stats. */
export function careerFromProgress(
  profile: Pick<
    PublicProfile,
    | 'predictions_made'
    | 'accuracy'
    | 'exact_scores'
    | 'points_total'
    | 'consecutive_correct'
  >,
  progress: Array<{ condition_metric: string; current_value: number }>,
): PublicProfileCareer {
  const metric = (key: string) => {
    let best = 0
    for (const row of progress) {
      if (row.condition_metric === key) {
        best = Math.max(best, Number(row.current_value) || 0)
      }
    }
    return best
  }

  return {
    predictionsMade: Math.max(
      profile.predictions_made,
      metric('predictions_made'),
    ),
    accuracy: profile.accuracy,
    exactScores: profile.exact_scores ?? metric('exact_scores'),
    totalPoints: profile.points_total ?? metric('points_total'),
  }
}

export function favoriteSportChips(
  favorites: string[] | null | undefined,
): FavoriteSportChip[] {
  if (!favorites?.length) return []
  const byId = new Map(
    ONBOARDING_SPORT_OPTIONS.map((s) => [s.id, s] as const),
  )
  const chips: FavoriteSportChip[] = []
  const seen = new Set<string>()
  for (const raw of favorites) {
    const id = raw.trim().toLowerCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const opt = byId.get(id as (typeof ONBOARDING_SPORT_OPTIONS)[number]['id'])
    chips.push({
      id,
      label: opt?.label ?? id.charAt(0).toUpperCase() + id.slice(1),
      ballSrc: opt?.ballSrc ?? null,
    })
  }
  return chips
}

/**
 * READ-ONLY achievements for a public profile.
 * NEVER calls evaluate_user_achievements (side-effecting).
 */
export async function fetchUserAchievementsReadOnly(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserAchievementsData> {
  if (!userId) return emptyAchievements('Missing user.')

  const [catalogueRes, earnedRes, ledgerXp] = await Promise.all([
    supabase
      .from('achievements')
      .select(ACHIEVEMENT_SELECT)
      .order('sort_order', { ascending: true }),
    supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', userId),
    fetchUserXpTotal(supabase, userId),
  ])

  if (catalogueRes.error) {
    return emptyAchievements(catalogueRes.error.message)
  }
  if (earnedRes.error) {
    return emptyAchievements(earnedRes.error.message)
  }

  return buildAchievementsData(
    (catalogueRes.data ?? []) as AchievementCatalogueRow[],
    (earnedRes.data ?? []) as UserAchievementRow[],
    [],
    null,
    ledgerXp,
  )
}
