import { hasClassicPredictionScores } from '@/src/lib/classic-prediction-progress'
import { TOURNAMENT_ROUND_LABELS } from '@/src/lib/tournament-round-labels'
import {
  isTournamentStageRound,
  isTournamentStyleMatches,
  type TournamentStageRoundId,
} from '@/src/lib/classic-round-tab-logic'

/**
 * Reverse-chronological stage order for ended-tournament recap.
 * Third place sits after semis when present (own group, not bundled under Final).
 */
export const ENDED_TOURNAMENT_STAGE_ORDER = [
  'final',
  'sf',
  'third',
  'qf',
  'r16',
  'r32',
  'group',
] as const satisfies readonly TournamentStageRoundId[]

export type EndedTournamentStageId =
  (typeof ENDED_TOURNAMENT_STAGE_ORDER)[number]

export type EndedTournamentStageItem = {
  round: string
  isFinal: boolean
  pointsAwarded: number | null
}

export type EndedTournamentStageGroup<T extends EndedTournamentStageItem> = {
  id: EndedTournamentStageId
  label: string
  matches: T[]
  /** Sum of pointsAwarded for matches the user picked; null → omit “You scored”. */
  userPoints: number | null
  /** Nested date horizons only for group stage. */
  nestDateGroups: boolean
}

/**
 * Ended tournament when every loaded match is final.
 * Cleanest page-local signal — same basis as pool.stage === 'Tournament complete'
 * (deriveCurrentTournamentStage), without needing sporting_events.status on this tab.
 */
export function isEndedTournamentPredictions(
  items: Array<{ round: string; isFinal: boolean }>,
): boolean {
  return (
    items.length > 0 &&
    isTournamentStyleMatches(items) &&
    items.every((item) => item.isFinal)
  )
}

export function formatEndedStageMeta(
  matchCount: number,
  userPoints: number | null,
): string {
  const countLabel = matchCount === 1 ? '1 match' : `${matchCount} matches`
  if (userPoints === null) return countLabel
  return `${countLabel} · You scored ${userPoints} pts`
}

/**
 * Group filtered predictions by knockout/group round for ended-event recap.
 * Empty stages omitted. Order: Final → SF → Third → QF → R16 → R32 → Group.
 */
export function buildEndedTournamentStageGroups<
  T extends EndedTournamentStageItem & {
    predTeam1?: string | number | null
    predTeam2?: string | number | null
  },
>(
  items: T[],
  options?: {
    hasPick?: (item: T) => boolean
  },
): EndedTournamentStageGroup<T>[] {
  const hasPick =
    options?.hasPick ??
    ((item: T) =>
      hasClassicPredictionScores(
        String(item.predTeam1 ?? ''),
        String(item.predTeam2 ?? ''),
      ))

  const buckets = new Map<EndedTournamentStageId, T[]>()
  for (const item of items) {
    if (!isTournamentStageRound(item.round)) continue
    const id = item.round as EndedTournamentStageId
    const list = buckets.get(id) ?? []
    list.push(item)
    buckets.set(id, list)
  }

  const groups: EndedTournamentStageGroup<T>[] = []
  for (const id of ENDED_TOURNAMENT_STAGE_ORDER) {
    const matches = buckets.get(id)
    if (!matches?.length) continue

    let pickCount = 0
    let pointsSum = 0
    for (const match of matches) {
      if (!hasPick(match)) continue
      pickCount += 1
      pointsSum += match.pointsAwarded ?? 0
    }

    groups.push({
      id,
      label: TOURNAMENT_ROUND_LABELS[id],
      matches,
      userPoints: pickCount > 0 ? pointsSum : null,
      nestDateGroups: id === 'group',
    })
  }

  return groups
}
