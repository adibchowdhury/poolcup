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

/**
 * Strict server-side validation for classic pool scoring config.
 * Exact must be > 0; winner/draw may be 0; all integers in [0, 100].
 */
export function validateClassicScoringPoints(input: {
  exact: unknown
  winner: unknown
  draw: unknown
}): { ok: true; exact: number; winner: number; draw: number } | { ok: false; error: string } {
  function parseOne(
    value: unknown,
    label: string,
    opts: { allowZero: boolean },
  ): number | string {
    if (typeof value === 'string' && value.trim() === '') {
      return `${label} is required`
    }
    const n =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN
    if (!Number.isFinite(n) || Number.isNaN(n)) {
      return `${label} must be a number`
    }
    if (!Number.isInteger(n)) {
      return `${label} must be a whole number`
    }
    if (n < CLASSIC_SCORE_POINTS_MIN || n > CLASSIC_SCORE_POINTS_MAX) {
      return `${label} must be between ${CLASSIC_SCORE_POINTS_MIN} and ${CLASSIC_SCORE_POINTS_MAX}`
    }
    if (!opts.allowZero && n <= 0) {
      return `${label} must be greater than 0`
    }
    if (n < 0) {
      return `${label} cannot be negative`
    }
    return n
  }

  const exact = parseOne(input.exact, 'Exact score points', { allowZero: false })
  if (typeof exact === 'string') return { ok: false, error: exact }
  const winner = parseOne(input.winner, 'Winner points', { allowZero: true })
  if (typeof winner === 'string') return { ok: false, error: winner }
  const draw = parseOne(input.draw, 'Draw points', { allowZero: true })
  if (typeof draw === 'string') return { ok: false, error: draw }

  return { ok: true, exact, winner, draw }
}
