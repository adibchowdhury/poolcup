import Link from 'next/link'
import {
  formatPickEmKickoffEt,
  pickEmTeamInitials,
  type PickEmSlateMatch,
} from '@/src/lib/pick-em-marketing-slate'
import { cn } from '@/lib/utils'

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
      {pickEmTeamInitials(name)}
    </span>
  )
}

function MatchupRow({ match }: { match: PickEmSlateMatch }) {
  const kickoffLabel = formatPickEmKickoffEt(match.kickoff_at)

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

type PickEmMatchupsSectionProps = {
  headingId: string
  heading: string
  matches: PickEmSlateMatch[]
  emptyMessage: string
  quietCta?: { href: string; label: string } | null
}

/**
 * Shared matchups section for pick'em marketing pages (server component).
 * Week-hub children can link to this section via headingId anchor.
 */
export function PickEmMatchupsSection({
  headingId,
  heading,
  matches,
  emptyMessage,
  quietCta,
}: PickEmMatchupsSectionProps) {
  return (
    <section
      className="border-t border-[rgba(255,255,255,0.06)] px-6 py-14 md:py-20"
      aria-labelledby={headingId}
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id={headingId}
          className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
        >
          {heading}
        </h2>

        {matches.length === 0 ? (
          <p className="mx-auto mt-8 max-w-xl text-center text-base leading-relaxed text-[#728d9c]">
            {emptyMessage}
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

        {quietCta ? (
          <p className="mt-10 text-center text-sm text-[#728d9c]">
            <Link
              href={quietCta.href}
              className="font-medium text-[#00e676] underline-offset-4 hover:underline"
            >
              {quietCta.label}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  )
}
