/**
 * TEMPORARY TEST CODE — remove before shipping celebrations permanently.
 *
 * When true, the BadgeUnlockModal forces the "Welcome Aboard" badge popup on
 * every dashboard / achievements load so you can preview the design.
 *
 * Flip to `false` (or delete this file + its imports) to turn off.
 */
export const TEST_FORCE_WELCOME_BADGE = true

/** TEMPORARY TEST CODE — sample payload for the forced Welcome Aboard popup. */
export const TEST_WELCOME_ABOARD_BADGE = {
  id: 'welcome_aboard',
  name: 'Welcome Aboard',
  xp_value: 10,
} as const
