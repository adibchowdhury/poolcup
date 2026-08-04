/** Classic Score Predictor defaults (engine coalesces null → these). */
export const CLASSIC_DEFAULT_EXACT_POINTS = 5
export const CLASSIC_DEFAULT_WINNER_POINTS = 2
export const CLASSIC_DEFAULT_DRAW_POINTS = 3

export const CLASSIC_SCORE_POINTS_MIN = 0
export const CLASSIC_SCORE_POINTS_MAX = 100

export type ClassicScorePoints = {
  exact: number
  winner: number
  draw: number
}

export function resolveClassicScorePoints(input: {
  scoreExactPoints?: number | null
  scoreWinnerPoints?: number | null
  scoreDrawPoints?: number | null
}): ClassicScorePoints {
  return {
    exact:
      input.scoreExactPoints == null
        ? CLASSIC_DEFAULT_EXACT_POINTS
        : clampScorePoints(input.scoreExactPoints),
    winner:
      input.scoreWinnerPoints == null
        ? CLASSIC_DEFAULT_WINNER_POINTS
        : clampScorePoints(input.scoreWinnerPoints),
    draw:
      input.scoreDrawPoints == null
        ? CLASSIC_DEFAULT_DRAW_POINTS
        : clampScorePoints(input.scoreDrawPoints),
  }
}

export function clampScorePoints(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(
    CLASSIC_SCORE_POINTS_MAX,
    Math.max(CLASSIC_SCORE_POINTS_MIN, Math.round(value)),
  )
}

export function parseScorePointsInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  return clampScorePoints(n)
}

/** Store null when value matches engine default (optional cleanup). */
export function scorePointsForDb(
  value: number | null,
  defaultValue: number,
): number | null {
  if (value == null) return null
  const clamped = clampScorePoints(value)
  return clamped === defaultValue ? null : clamped
}
