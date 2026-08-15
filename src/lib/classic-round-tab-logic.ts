import type { ClassicRoundTabId } from '@/components/predict/group-knockout-tabs'
import { CLASSIC_ROUND_TAB_ORDER } from '@/components/predict/group-knockout-tabs'
import { isMatchLocked } from '@/src/lib/match-lock'
import { TOURNAMENT_ROUND_LABELS } from '@/src/lib/tournament-round-labels'

export const KNOCKOUT_ROUND_IDS = [
  'r32',
  'r16',
  'qf',
  'sf',
  'third',
  'final',
] as const

export type KnockoutRoundId = (typeof KNOCKOUT_ROUND_IDS)[number]

/** World Cup–style stage rounds used by classic predict tabs. */
export const TOURNAMENT_STAGE_ROUND_IDS = [
  'group',
  ...KNOCKOUT_ROUND_IDS,
] as const

export type TournamentStageRoundId = (typeof TOURNAMENT_STAGE_ROUND_IDS)[number]

export function isKnockoutRound(round: string): round is KnockoutRoundId {
  return (KNOCKOUT_ROUND_IDS as readonly string[]).includes(round)
}

export function isTournamentStageRound(
  round: string,
): round is TournamentStageRoundId {
  return (TOURNAMENT_STAGE_ROUND_IDS as readonly string[]).includes(round)
}

/**
 * Tournament mode when any match uses a WC stage round (group / knockout).
 * Otherwise season mode: flat chronological list (league, regular, preseason, …).
 */
export function isTournamentStyleMatches(
  items: Array<{ round: string }>,
): boolean {
  return items.some((item) => isTournamentStageRound(item.round))
}

export function matchInClassicRoundTab(
  round: string,
  tab: ClassicRoundTabId,
): boolean {
  if (tab === 'final' && round === 'third') return true
  return round === tab
}

export function classicRoundTabEmptyMessage(tab: ClassicRoundTabId): string {
  const label = TOURNAMENT_ROUND_LABELS[tab]
  if (tab === 'group') {
    return 'Group stage fixtures will appear here once they are scheduled.'
  }
  if (tab === 'r32') {
    return `${label} matchups are set once the group stage ends.`
  }
  if (tab === 'r16') {
    return `${label} matchups are set once the Round of 32 ends.`
  }
  if (tab === 'qf') {
    return `${label} matchups are set once the Round of 16 ends.`
  }
  if (tab === 'sf') {
    return `${label} matchups are set once the quarter-finals end.`
  }
  return `${label} matchups are set once the semifinals end.`
}

type RoundTabItem = {
  round: string
}

/**
 * Default stage tab for classic score pools — mirrors predict/page.tsx on load.
 */
export function resolveDefaultClassicRoundTab<T extends RoundTabItem>(
  items: T[],
  isPriorityItem?: (item: T) => boolean,
): ClassicRoundTabId {
  if (isPriorityItem) {
    for (const tab of CLASSIC_ROUND_TAB_ORDER) {
      if (
        items.some(
          (item) => matchInClassicRoundTab(item.round, tab) && isPriorityItem(item),
        )
      ) {
        return tab
      }
    }
  }

  if (!items.some((item) => isKnockoutRound(item.round))) {
    return 'group'
  }

  for (const tab of CLASSIC_ROUND_TAB_ORDER) {
    if (items.some((item) => matchInClassicRoundTab(item.round, tab))) {
      return tab
    }
  }

  return 'group'
}

export function resolveDefaultClassicRoundTabForPredictions(
  predictions: Array<{ round: string; lockedAt: string | null }>,
): ClassicRoundTabId {
  return resolveDefaultClassicRoundTab(predictions, (item) =>
    !isMatchLocked(item.lockedAt ?? null),
  )
}
