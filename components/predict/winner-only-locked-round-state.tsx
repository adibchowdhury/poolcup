'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import type { WinnerOnlyRoundTabId } from '@/components/predict/winner-only-round-tabs'

type LockedKnockoutRoundTab = Exclude<WinnerOnlyRoundTabId, 'bracket'>

const ROUND_LABELS: Record<LockedKnockoutRoundTab, string> = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarterfinals',
  sf: 'Semifinals',
  final: 'Final',
}

const PREVIOUS_ROUND: Record<
  Exclude<LockedKnockoutRoundTab, 'r32'>,
  { label: string; tab: LockedKnockoutRoundTab | 'bracket' }
> = {
  r16: { label: 'Round of 32', tab: 'r32' },
  qf: { label: 'Round of 16', tab: 'r16' },
  sf: { label: 'Quarterfinals', tab: 'qf' },
  final: { label: 'Semifinals', tab: 'sf' },
}

function getLockedRoundCopy(roundTab: LockedKnockoutRoundTab): {
  heading: string
  subtext: string
  ctaLabel: string
  ctaTab: WinnerOnlyRoundTabId
} {
  const roundLabel = ROUND_LABELS[roundTab]

  if (roundTab === 'r32') {
    return {
      heading: `${roundLabel} locked`,
      subtext:
        'Finish ranking all 12 groups and picking your 8 best third-place teams to unlock these matchups.',
      ctaLabel: 'Go to Group Stage',
      ctaTab: 'bracket',
    }
  }

  const previous = PREVIOUS_ROUND[roundTab]
  return {
    heading: `${roundLabel} locked`,
    subtext: `Make your ${previous.label} picks first.`,
    ctaLabel: `Go to ${previous.label}`,
    ctaTab: previous.tab,
  }
}

interface WinnerOnlyLockedRoundStateProps {
  roundTab: LockedKnockoutRoundTab
  onGoToTab: (tab: WinnerOnlyRoundTabId) => void
}

export function WinnerOnlyLockedRoundState({
  roundTab,
  onGoToTab,
}: WinnerOnlyLockedRoundStateProps) {
  const { heading, subtext, ctaLabel, ctaTab } = getLockedRoundCopy(roundTab)

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-9 text-center">
      <Image
        src="/under-construction.png"
        alt=""
        width={800}
        height={438}
        className="mb-8 h-auto w-[390px] sm:w-[546px]"
      />
      <h2 className="font-display text-3xl tracking-wide text-foreground">
        {heading}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
        {subtext}
      </p>
      <Button
        type="button"
        className="mt-8"
        onClick={() => onGoToTab(ctaTab)}
      >
        {ctaLabel}
      </Button>
    </div>
  )
}
