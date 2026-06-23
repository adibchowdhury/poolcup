'use client'

import {
  KnockoutBracketForTab,
  type KnockoutBracketTabId,
} from '@/components/predict/knockout-bracket-preview'
import { TOURNAMENT_ROUND_LABELS } from '@/src/lib/tournament-round-labels'
import type { WinnerOnlyRoundTabId } from '@/components/predict/winner-only-round-tabs'

export const KNOCKOUT_TAB_INTRO: Record<KnockoutBracketTabId, string> = {
  r32: `This bracket fills in automatically once the ${TOURNAMENT_ROUND_LABELS.group.toLowerCase()} ends. Preview only — picks are not active yet.`,
  r16: `This bracket fills in automatically once the ${TOURNAMENT_ROUND_LABELS.r32} ends. Preview only — picks are not active yet.`,
  qf: `This bracket fills in automatically once the ${TOURNAMENT_ROUND_LABELS.r16} ends. Preview only — picks are not active yet.`,
  sf: `This bracket fills in automatically once the ${TOURNAMENT_ROUND_LABELS.qf} ends. Preview only — picks are not active yet.`,
  final: `This bracket fills in automatically once the ${TOURNAMENT_ROUND_LABELS.sf} end. Preview only — picks are not active yet.`,
}

export function isKnockoutBracketTab(
  tab: WinnerOnlyRoundTabId,
): tab is KnockoutBracketTabId {
  return tab !== 'bracket'
}

export function KnockoutBracketTab({
  tab,
}: {
  tab: Exclude<WinnerOnlyRoundTabId, 'bracket'>
}) {
  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      <p className="mx-auto max-w-2xl px-4 text-center text-sm text-muted-foreground">
        {KNOCKOUT_TAB_INTRO[tab]}
      </p>

      <KnockoutBracketForTab tab={tab} />
    </div>
  )
}
