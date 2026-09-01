/**
 * Single source for CFB pick'em season copy on /college-football-pick-em.
 * Update CFB_PICK_EM_SEASON_YEAR annually (title metadata keeps the year for CTR).
 */
export const CFB_PICK_EM_SEASON_YEAR = 2026

/** Create-wizard deep-link slug — resolves sporting_events at query time. */
export const CFB_PICK_EM_EVENT_SLUG = 'ncaa-football-2026' as const

/** Hero season-underway line — year from CFB_PICK_EM_SEASON_YEAR. */
export function cfbPickEmSeasonUnderwayLine(): string {
  return `The ${CFB_PICK_EM_SEASON_YEAR} college football season is underway — pools launching this week.`
}
