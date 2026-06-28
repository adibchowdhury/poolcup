'use client'

import {
  KnockoutBracketForTab,
  type R32BracketInteractiveProps,
} from '@/components/predict/knockout-bracket-preview'
import { TOURNAMENT_ROUND_LABELS } from '@/src/lib/tournament-round-labels'
import type { WinnerOnlyRoundTabId } from '@/components/predict/winner-only-round-tabs'
import type { KnockoutBracketTabId } from '@/components/predict/knockout-bracket-preview'

export const KNOCKOUT_TAB_INTRO: Record<KnockoutBracketTabId, string> = {
  r32: 'Pick who advances in each Round of 32 matchup. Each pick locks at kickoff.',
  r16: `Unlocks once the ${TOURNAMENT_ROUND_LABELS.r32} is complete.`,
  qf: `Unlocks once the ${TOURNAMENT_ROUND_LABELS.r16} is complete.`,
  sf: `Unlocks once the ${TOURNAMENT_ROUND_LABELS.qf} end.`,
  final: `Unlocks once the ${TOURNAMENT_ROUND_LABELS.sf} end.`,
}

export const KNOCKOUT_PICK_LABELS: Record<KnockoutBracketTabId, string> = {
  r32: `${TOURNAMENT_ROUND_LABELS.r32} picks`,
  r16: `${TOURNAMENT_ROUND_LABELS.r16} picks`,
  qf: `${TOURNAMENT_ROUND_LABELS.qf} picks`,
  sf: `${TOURNAMENT_ROUND_LABELS.sf} picks`,
  final: `${TOURNAMENT_ROUND_LABELS.final} picks`,
}

export function isKnockoutBracketTab(
  tab: WinnerOnlyRoundTabId,
): tab is KnockoutBracketTabId {
  return tab !== 'bracket'
}

export function KnockoutBracketTab({
  tab,
  r32Bracket,
  pickError,
}: {
  tab: Exclude<WinnerOnlyRoundTabId, 'bracket'>
  r32Bracket?: R32BracketInteractiveProps
  pickError?: string | null
}) {
  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      <p className="mx-auto max-w-2xl px-4 text-center text-sm text-muted-foreground">
        {KNOCKOUT_TAB_INTRO[tab]}
      </p>

      {pickError ? (
        <p className="mx-auto max-w-2xl px-4 text-center text-sm text-destructive">
          {pickError}
        </p>
      ) : null}

      <KnockoutBracketForTab
        tab={tab}
        r32Bracket={tab === 'r32' || tab === 'r16' ? r32Bracket : undefined}
      />
    </div>
  )
}
