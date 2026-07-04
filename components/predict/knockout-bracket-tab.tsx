'use client'

import {
  KnockoutBracketForTab,
  type KnockoutRoundBracketProps,
  type R32BracketInteractiveProps,
} from '@/components/predict/knockout-bracket-preview'
import { BRACKET_FULL_BLEED_WRAPPER_STYLE } from '@/components/pool/bracket-visual-tree'
import { TOURNAMENT_ROUND_LABELS } from '@/src/lib/tournament-round-labels'
import type { WinnerOnlyRoundTabId } from '@/components/predict/winner-only-round-tabs'
import type { KnockoutBracketTabId } from '@/components/predict/knockout-bracket-preview'

export const KNOCKOUT_TAB_INTRO: Record<KnockoutBracketTabId, string> = {
  r32: 'Pick who advances in each Round of 32 matchup. Each pick locks at kickoff.',
  r16: 'Pick who advances in each Round of 16 matchup. Each pick locks at kickoff.',
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
  r16Bracket,
  pickError,
  embedded = false,
}: {
  tab: Exclude<WinnerOnlyRoundTabId, 'bracket'>
  r32Bracket?: R32BracketInteractiveProps
  r16Bracket?: KnockoutRoundBracketProps
  pickError?: string | null
  embedded?: boolean
}) {
  const desktopBracket = (
    <KnockoutBracketForTab
      tab={tab}
      r32Bracket={tab === 'r32' ? r32Bracket : undefined}
      r16Bracket={tab === 'r16' ? r16Bracket : undefined}
      desktopOnly
    />
  )

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

      {embedded ? (
        <div className="hidden md:block" style={BRACKET_FULL_BLEED_WRAPPER_STYLE}>
          {desktopBracket}
        </div>
      ) : (
        <KnockoutBracketForTab
          tab={tab}
          r32Bracket={tab === 'r32' ? r32Bracket : undefined}
          r16Bracket={tab === 'r16' ? r16Bracket : undefined}
        />
      )}

      {embedded ? (
        <KnockoutBracketForTab
          tab={tab}
          r32Bracket={tab === 'r32' ? r32Bracket : undefined}
          r16Bracket={tab === 'r16' ? r16Bracket : undefined}
          mobileOnly
        />
      ) : null}
    </div>
  )
}
