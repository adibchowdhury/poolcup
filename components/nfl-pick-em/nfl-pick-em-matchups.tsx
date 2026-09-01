import Link from 'next/link'
import { NFL_PICK_EM_CREATE_LOGIN_HREF } from '@/src/lib/nfl-pick-em-links'
import {
  formatNflKickoffEt,
  nflTeamInitials,
  type NflPickEmSlateMatch,
} from '@/src/lib/fetch-nfl-pick-em-slate'
import { cn } from '@/lib/utils'

/**
 * Quiet funnel link under the slate.
 * Logged-out create href (SEO primary). Login?next=… lands on the wizard.
 */
function QuietCreateCta({ className }: { className?: string }) {
  return (
    <p className={cn('text-center text-sm text-[#728d9c]', className)}>
      <Link
        href={NFL_PICK_EM_CREATE_LOGIN_HREF}
        className="font-medium text-[#00e676] underline-offset-4 hover:underline"
      >
        Get your pool ready before kickoff
      </Link>
    </p>
  )
}

function TeamCrest({
  name,
  logoUrl,
}: {
  name: string
  logoUrl: string | null
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote API-Sports crests; marketing page avoids next/image domain config
      <img
        src={logoUrl}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 object-contain"
      />
    )
  }

  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[#141a22] text-[10px] font-bold tracking-wide text-[#c5d0d8]"
      aria-hidden
    >
      {nflTeamInitials(name)}
    </span>
  )
}

function MatchupRow({ match }: { match: NflPickEmSlateMatch }) {
  const kickoffLabel = formatNflKickoffEt(match.kickoff_at)

  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0a0e12]/80 px-3.5 py-3">
      {kickoffLabel ? (
        <time
          dateTime={match.kickoff_at}
          className="text-[11px] font-medium tabular-nums text-[#728d9c] sm:text-xs"
        >
          {kickoffLabel}
        </time>
      ) : null}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamCrest name={match.team1_name} logoUrl={match.team1_logo} />
          <span className="min-w-0 text-sm font-semibold leading-snug text-[#f0f4f8]">
            {match.team1_name}
          </span>
        </div>
        <span
          className="shrink-0 px-0.5 font-display text-xs tracking-wide text-[#728d9c]"
          aria-hidden
        >
          vs
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="min-w-0 text-right text-sm font-semibold leading-snug text-[#f0f4f8]">
            {match.team2_name}
          </span>
          <TeamCrest name={match.team2_name} logoUrl={match.team2_logo} />
        </div>
      </div>
    </li>
  )
}

type NflPickEmMatchupsProps = {
  matches: NflPickEmSlateMatch[]
}

/**
 * Phase 3 matchups — lean presentational rows (server component).
 * Borrows match-card visual language (crest + name + kickoff) without
 * PremiumMatchCard / CompactMatchRow client machinery.
 *
 * Heading: DB `round` is only `"regular"` (no week number) → "This Week's NFL Games".
 */
export function NflPickEmMatchups({ matches }: NflPickEmMatchupsProps) {
  return (
    <section
      className="border-t border-[rgba(255,255,255,0.06)] px-6 py-14 md:py-20"
      aria-labelledby="nfl-pick-em-matchups-heading"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="nfl-pick-em-matchups-heading"
          className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
        >
          This Week&apos;s NFL Games
        </h2>

        {matches.length === 0 ? (
          <p className="mx-auto mt-8 max-w-xl text-center text-base leading-relaxed text-[#728d9c]">
            The 2026 season schedule is loading — check back soon.
          </p>
        ) : (
          <ul
            className={cn(
              'mt-10 grid grid-cols-1 gap-3',
              'md:grid-cols-2 xl:grid-cols-3',
            )}
          >
            {matches.map((match) => (
              <MatchupRow key={match.id} match={match} />
            ))}
          </ul>
        )}

        <QuietCreateCta className="mt-10" />
      </div>
    </section>
  )
}
