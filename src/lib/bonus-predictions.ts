import type { SupabaseClient } from '@supabase/supabase-js'

export const BONUS_CATEGORIES = [
  {
    id: 'total_goals_ou',
    label: 'Total goals',
    points: 1,
    options: [
      { value: 'over', label: 'Over 2.5' },
      { value: 'under', label: 'Under 2.5' },
    ],
  },
  {
    id: 'btts',
    label: 'Both teams to score',
    points: 1,
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    id: 'margin',
    label: 'Winning margin',
    points: 2,
    options: [
      { value: 'draw', label: 'Draw' },
      { value: 'm1', label: 'By 1' },
      { value: 'm2', label: 'By 2' },
      { value: 'm3plus', label: 'By 3+' },
    ],
  },
] as const

export type BonusCategoryId = (typeof BONUS_CATEGORIES)[number]['id']

export type BonusCategory = (typeof BONUS_CATEGORIES)[number]

export type MatchBonusPick = {
  memberId: string
  displayName: string
  userId: string
  categoryId: BonusCategoryId
  answer: string
  pointsAwarded: number
}

const CATEGORY_BY_ID = new Map(
  BONUS_CATEGORIES.map((category) => [category.id, category]),
)

export function getBonusCategory(id: BonusCategoryId): BonusCategory {
  const category = CATEGORY_BY_ID.get(id)
  if (!category) {
    throw new Error(`Unknown bonus category: ${id}`)
  }
  return category
}

export function formatBonusAnswerLabel(
  categoryId: BonusCategoryId,
  answer: string,
): string {
  const category = getBonusCategory(categoryId)
  const option = category.options.find((entry) => entry.value === answer)
  return option?.label ?? answer
}

export function deriveLiveBonusAnswers(
  resultTeam1: number | null,
  resultTeam2: number | null,
): Record<BonusCategoryId, string> | null {
  if (resultTeam1 == null || resultTeam2 == null) {
    return null
  }

  const total = resultTeam1 + resultTeam2
  const diff = Math.abs(resultTeam1 - resultTeam2)

  let margin: string
  if (diff === 0) margin = 'draw'
  else if (diff === 1) margin = 'm1'
  else if (diff === 2) margin = 'm2'
  else margin = 'm3plus'

  return {
    total_goals_ou: total >= 3 ? 'over' : 'under',
    btts: resultTeam1 >= 1 && resultTeam2 >= 1 ? 'yes' : 'no',
    margin,
  }
}

type OwnBonusRow = {
  category_id: string
  answer: string
}

type PoolBonusRow = {
  category_id: string
  answer: string
  points_awarded: number | null
  member_id: string
  pool_members:
    | { display_name: string; user_id: string }
    | { display_name: string; user_id: string }[]
    | null
}

export async function fetchOwnBonusPicks(
  supabase: SupabaseClient,
  poolId: string,
  matchId: string,
  memberId: string,
): Promise<{ picksByCategory: Map<BonusCategoryId, string>; error: string | null }> {
  const picksByCategory = new Map<BonusCategoryId, string>()

  const { data, error } = await supabase
    .from('bonus_predictions')
    .select('category_id, answer')
    .eq('pool_id', poolId)
    .eq('match_id', matchId)
    .eq('member_id', memberId)

  if (error) {
    return { picksByCategory, error: error.message }
  }

  for (const row of (data ?? []) as OwnBonusRow[]) {
    if (isBonusCategoryId(row.category_id)) {
      picksByCategory.set(row.category_id, row.answer)
    }
  }

  return { picksByCategory, error: null }
}

export async function fetchMatchBonusPicks(
  supabase: SupabaseClient,
  poolId: string,
  matchId: string,
): Promise<{ picks: MatchBonusPick[]; error: string | null }> {
  const { data, error } = await supabase
    .from('bonus_predictions')
    .select(
      `
      category_id,
      answer,
      points_awarded,
      member_id,
      pool_members!inner (
        display_name,
        user_id
      )
    `,
    )
    .eq('pool_id', poolId)
    .eq('match_id', matchId)

  if (error) {
    return { picks: [], error: error.message }
  }

  const picks: MatchBonusPick[] = []

  for (const row of (data ?? []) as PoolBonusRow[]) {
    if (!isBonusCategoryId(row.category_id)) continue

    const memberRaw = row.pool_members
    const member = Array.isArray(memberRaw) ? memberRaw[0] : memberRaw
    if (!member) continue

    picks.push({
      memberId: row.member_id,
      displayName: member.display_name,
      userId: member.user_id,
      categoryId: row.category_id,
      answer: row.answer,
      pointsAwarded: row.points_awarded ?? 0,
    })
  }

  picks.sort((a, b) => {
    const categoryOrder =
      BONUS_CATEGORIES.findIndex((c) => c.id === a.categoryId) -
      BONUS_CATEGORIES.findIndex((c) => c.id === b.categoryId)
    if (categoryOrder !== 0) return categoryOrder
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: 'base',
    })
  })

  return { picks, error: null }
}

export async function upsertBonusPick(
  supabase: SupabaseClient,
  {
    poolId,
    memberId,
    matchId,
    categoryId,
    answer,
  }: {
    poolId: string
    memberId: string
    matchId: string
    categoryId: BonusCategoryId
    answer: string
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('bonus_predictions').upsert(
    {
      pool_id: poolId,
      member_id: memberId,
      match_id: matchId,
      category_id: categoryId,
      answer,
    },
    { onConflict: 'pool_id,member_id,match_id,category_id' },
  )

  return { error: error?.message ?? null }
}

function isBonusCategoryId(value: string): value is BonusCategoryId {
  return BONUS_CATEGORIES.some((category) => category.id === value)
}
