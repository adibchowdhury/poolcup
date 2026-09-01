import { PickEmMatchupsSection } from '@/components/pick-em-marketing/pick-em-matchups-section'
import { NFL_PICK_EM_CREATE_LOGIN_HREF } from '@/src/lib/nfl-pick-em-links'
import type { NflPickEmSlateMatch } from '@/src/lib/fetch-nfl-pick-em-slate'

type NflPickEmMatchupsProps = {
  matches: NflPickEmSlateMatch[]
}

/**
 * Phase 3 matchups — lean presentational rows (server component).
 * Heading: DB `round` is only `"regular"` (no week number) → "This Week's NFL Games".
 */
export function NflPickEmMatchups({ matches }: NflPickEmMatchupsProps) {
  return (
    <PickEmMatchupsSection
      headingId="nfl-pick-em-matchups-heading"
      heading="This Week's NFL Games"
      matches={matches}
      emptyMessage="The 2026 season schedule is loading — check back soon."
      quietCta={{
        href: NFL_PICK_EM_CREATE_LOGIN_HREF,
        label: 'Get your pool ready before kickoff',
      }}
    />
  )
}
