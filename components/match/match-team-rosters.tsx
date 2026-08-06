'use client'

import { useState } from 'react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import {
  playerMonogram,
  type TeamRosterPlayer,
} from '@/src/lib/team-roster'
import { cn } from '@/lib/utils'

function PlayerCircle({ player }: { player: TeamRosterPlayer }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const showPhoto = Boolean(player.photo) && !photoFailed
  const monogram = playerMonogram(player.name)
  const metaBits = [
    player.number != null ? `#${player.number}` : null,
    player.position,
  ].filter(Boolean)

  return (
    <li className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5 sm:w-[5.25rem]">
      <div
        className={cn(
          'relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-muted/50 sm:h-16 sm:w-16',
          'shadow-[0_4px_14px_rgba(0,0,0,0.35)]',
        )}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photo!}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <span
            className="font-display text-sm tracking-wide text-muted-foreground sm:text-base"
            aria-hidden
          >
            {monogram}
          </span>
        )}
      </div>
      <p className="w-full truncate text-center text-[11px] font-medium leading-tight text-foreground sm:text-xs">
        {player.name}
      </p>
      {metaBits.length > 0 ? (
        <p className="w-full truncate text-center text-[10px] text-muted-foreground">
          {metaBits.join(' · ')}
        </p>
      ) : null}
    </li>
  )
}

function TeamRosterRow({
  teamName,
  teamFlag,
  teamLogo,
  players,
}: {
  teamName: string
  teamFlag: string | null
  teamLogo: string | null
  players: TeamRosterPlayer[]
}) {
  if (players.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 px-0.5">
        <TeamFlagImage
          countryName={teamName}
          dbFlag={teamFlag}
          logoUrl={teamLogo}
          imgClassName="h-6 w-auto max-w-[1.75rem] object-contain"
          emojiClassName="text-lg leading-none"
        />
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg tracking-wide text-foreground sm:text-xl">
            {teamName}
          </h3>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {players.length} players
          </p>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:thin]">
        <ul className="flex w-max gap-3 sm:gap-3.5">
          {players.map((player) => (
            <PlayerCircle key={player.apiId} player={player} />
          ))}
        </ul>
      </div>
    </div>
  )
}

export type MatchTeamRostersProps = {
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
  team1Logo: string | null
  team2Logo: string | null
  team1Players: TeamRosterPlayer[]
  team2Players: TeamRosterPlayer[]
  loading?: boolean
}

export function MatchTeamRosters({
  team1Name,
  team2Name,
  team1Flag,
  team2Flag,
  team1Logo,
  team2Logo,
  team1Players,
  team2Players,
  loading = false,
}: MatchTeamRostersProps) {
  const hasAny = team1Players.length > 0 || team2Players.length > 0

  if (loading) {
    return (
      <section
        className="rounded-2xl border border-white/[0.08] bg-card/20 px-4 py-5 sm:px-5"
        aria-busy="true"
        aria-label="Loading team rosters"
      >
        <h2 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
          Team roster
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading squads…</p>
      </section>
    )
  }

  if (!hasAny) return null

  return (
    <section className="space-y-6 rounded-2xl border border-white/[0.08] bg-card/20 px-4 py-5 sm:px-5">
      <div>
        <h2 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
          Team roster
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Swipe to browse each squad.
        </p>
      </div>

      <TeamRosterRow
        teamName={team1Name}
        teamFlag={team1Flag}
        teamLogo={team1Logo}
        players={team1Players}
      />
      <TeamRosterRow
        teamName={team2Name}
        teamFlag={team2Flag}
        teamLogo={team2Logo}
        players={team2Players}
      />
    </section>
  )
}
