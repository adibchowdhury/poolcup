/** Prediction-day streak (eligible days with matches). Not consecutive-correct. */

export const STREAK_MILESTONE_XP = {
  3: 15,
  7: 25,
  14: 40,
  30: 75,
} as const

export type StreakMilestone = keyof typeof STREAK_MILESTONE_XP

export const STREAK_MILESTONES = [3, 7, 14, 30] as const satisfies readonly StreakMilestone[]

export const STREAK_DEFINITION =
  'Your prediction streak counts consecutive days you make at least one prediction. Days with no matches scheduled don\'t count against you — your streak carries over. Predict on every day that has matches to keep it alive.'

export type PredictionStreak = {
  current_streak: number
  longest_streak: number
  last_predicted_day: string | null
  today_is_eligible: boolean
  today_is_open: boolean
  today_predicted: boolean
}

export type StreakMilestoneAward = {
  milestone: number
  xp_awarded: number
}

export type StreakSyncResponse = PredictionStreak & {
  last_seen_streak: number
  milestones: StreakMilestoneAward[]
  xpAwarded: number
  levelBefore: number
  levelAfter: number
  highestLevel: number
  totalXp: number
  error?: string
}

export function normalizePredictionStreak(raw: unknown): PredictionStreak {
  const row = (Array.isArray(raw) ? raw[0] : raw) as
    | Record<string, unknown>
    | null
    | undefined
  return {
    current_streak: Math.max(0, Number(row?.current_streak) || 0),
    longest_streak: Math.max(0, Number(row?.longest_streak) || 0),
    last_predicted_day:
      typeof row?.last_predicted_day === 'string'
        ? row.last_predicted_day
        : row?.last_predicted_day != null
          ? String(row.last_predicted_day)
          : null,
    today_is_eligible: Boolean(row?.today_is_eligible),
    today_is_open: Boolean(row?.today_is_open),
    today_predicted: Boolean(row?.today_predicted),
  }
}
