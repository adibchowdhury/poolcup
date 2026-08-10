/**
 * VOID match statuses (API-Football `matches.status_short`).
 *
 * Product rule — postponed / cancelled / abandoned (and related non-result)
 * matches are VOID:
 * - Predictions are not scored
 * - No points are awarded
 * - UI shows a neutral "no result" / voided state (not correct, not wrong)
 *
 * Scoring already never runs for these (sync skips non-syncable statuses;
 * reconcile blocks hard force-close). Do not change `calculate_match_points`
 * for this UI treatment — keep scoring pipelines as-is.
 */
export const VOID_MATCH_STATUS_SHORTS = [
  'PST',
  'CANC',
  'ABD',
  'AWD',
  'WO',
] as const

export type VoidMatchStatusShort = (typeof VOID_MATCH_STATUS_SHORTS)[number]

const VOID_STATUS_SET = new Set<string>(VOID_MATCH_STATUS_SHORTS)

export function normalizeMatchStatusShort(
  statusShort: string | null | undefined,
): string {
  return (statusShort ?? '').trim().toUpperCase()
}

export function isVoidMatchStatus(
  statusShort: string | null | undefined,
): boolean {
  return VOID_STATUS_SET.has(normalizeMatchStatusShort(statusShort))
}

/**
 * Human labels for void fixtures.
 * Mapping:
 * - PST → Postponed — no result
 * - CANC → Cancelled — no points
 * - ABD → Abandoned — voided
 * - AWD → Awarded — no points
 * - WO → Walkover — no points
 */
export function getVoidMatchStatusLabel(
  statusShort: string | null | undefined,
): string | null {
  switch (normalizeMatchStatusShort(statusShort)) {
    case 'PST':
      return 'Postponed — no result'
    case 'CANC':
      return 'Cancelled — no points'
    case 'ABD':
      return 'Abandoned — voided'
    case 'AWD':
      return 'Awarded — no points'
    case 'WO':
      return 'Walkover — no points'
    default:
      return null
  }
}

/** Neutral prediction outcome copy when the match is void. */
export function getVoidPredictionOutcomeLabel(): string {
  return 'Voided · no points'
}
