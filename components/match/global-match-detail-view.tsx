'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trophy } from 'lucide-react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import {
  FeaturedMatchCountdownDisplay,
  useKickoffCountdown,
} from '@/components/dashboard/live-scoreboard'
import {
  MatchHubPanels,
  type WritableScorePool,
} from '@/components/match/match-hub-panels'
import {
  formatFeaturedKickoffLocal,
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import type { GlobalMatchPhase } from '@/src/lib/global-match-phase'
import { getVoidMatchStatusLabel } from '@/src/lib/match-void-status'
import type {
  HeadToHeadData,
  MatchCommonScore,
  MatchConsensus,
  MatchEventInfo,
  MatchRelatedPool,
  TeamFormEntry,
} from '@/src/lib/match-hub-data'
import type { MyMatchPredictions } from '@/src/lib/my-match-predictions'
import type { TeamRosterPlayer } from '@/src/lib/team-roster'
import { sportIconPng } from '@/src/lib/sport-display'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { useAuth } from '@/src/lib/auth-context'
import { cn } from '@/lib/utils'

function navigateFromMatchDetailBack(
  router: ReturnType<typeof useRouter>,
  isLoggedIn: boolean,
) {
  if (!isLoggedIn) {
    router.push('/')
    return
  }

  if (typeof window !== 'undefined') {
    let sameOriginReferrer = false

    try {
      const referrer = document.referrer
      if (referrer) {
        sameOriginReferrer =
          new URL(referrer).origin === window.location.origin
      }
    } catch {
      sameOriginReferrer = false
    }

    if (sameOriginReferrer && window.history.length > 1) {
      router.back()
      return
    }
  }

  router.push('/dashboard')
}

export type GlobalMatchDisplay = {
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
  team1Logo: string | null
  team2Logo: string | null
  kickoffAt: string
  lockedAt: string | null
  round: string
  groupName: string | null
  resultTeam1: number | null
  resultTeam2: number | null
  advancingTeam: number | null
  statusShort: string | null
  elapsedMinute: number | null
  eventId: string | null
}

type GlobalMatchDetailViewProps = {
  match: GlobalMatchDisplay
  matchId: string
  phase: GlobalMatchPhase
  eventInfo: MatchEventInfo | null
  isLoggedIn: boolean
  consensus: MatchConsensus | null
  commonScores: MatchCommonScore[]
  myPredictions: MyMatchPredictions | null
  writablePools: WritableScorePool[]
  competitionPools: MatchRelatedPool[]
  team1Form: TeamFormEntry[]
  team2Form: TeamFormEntry[]
  headToHead: HeadToHeadData | null
  team1Players: TeamRosterPlayer[]
  team2Players: TeamRosterPlayer[]
  rostersLoading?: boolean
  onPredictionSaved?: () => void
}

function MatchStatusPill({
  phase,
  liveClockLabel,
  voidLabel,
}: {
  phase: GlobalMatchPhase
  liveClockLabel: string | null
  voidLabel: string | null
}) {
  if (phase === 'void') {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
        {voidLabel ?? 'No result'}
      </span>
    )
  }

  if (phase === 'live') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-match-live/40 bg-match-live/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-match-live',
          'match-hero-live-pill motion-reduce:shadow-none motion-reduce:animate-none',
        )}
      >
        <span className="stage-live-dot h-2 w-2 shrink-0 rounded-full" aria-hidden />
        Live {liveClockLabel ? `· ${liveClockLabel}` : ''}
      </span>
    )
  }

  if (phase === 'final') {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Full time
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
      Upcoming
    </span>
  )
}

export function GlobalMatchDetailView({
  match,
  matchId,
  phase,
  eventInfo,
  isLoggedIn,
  consensus,
  commonScores,
  myPredictions,
  writablePools,
  competitionPools,
  team1Form,
  team2Form,
  headToHead,
  team1Players,
  team2Players,
  rostersLoading = false,
  onPredictionSaved,
}: GlobalMatchDetailViewProps) {
  const router = useRouter()
  const { user } = useAuth()
  const kickoffCountdown = useKickoffCountdown(match.kickoffAt)
  const score1 = match.resultTeam1 ?? 0
  const score2 = match.resultTeam2 ?? 0
  const showLiveScore = phase === 'live' || phase === 'final'
  const voidLabel = getVoidMatchStatusLabel(match.statusShort)
  const liveClockLabel =
    phase === 'live'
      ? formatFeaturedMatchStatusLabel(
          match.statusShort,
          match.elapsedMinute,
          false,
        )
      : null
  const actualAdvancedTeamName =
    match.advancingTeam === 1
      ? match.team1Name
      : match.advancingTeam === 2
        ? match.team2Name
        : null
  const roundLabel = formatFeaturedMatchRoundLabel(match.round, match.groupName)
  const eventName = eventInfo?.name ?? null
  const sportBadge = eventInfo?.sport ? sportIconPng(eventInfo.sport) : null

  return (
    <div
      className={cn('min-h-screen bg-app-background', MOBILE_BOTTOM_NAV_PAD_CLASS)}
    >
      <div className="relative" id="main-content">
        <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-app-background/90 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-2.5 sm:py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  navigateFromMatchDetailBack(router, Boolean(user))
                }
                className="group shrink-0 rounded-lg p-2 transition-colors hover:bg-muted"
                aria-label={user ? 'Back to dashboard' : 'Back to home'}
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Match hub
                </p>
                <h1 className="truncate font-display text-lg tracking-wide text-foreground sm:text-xl">
                  {match.team1Name} vs {match.team2Name}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:space-y-6 sm:py-7">
          <section className="hue-card-surface relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#1a1a1a] via-app-background to-app-background px-4 pb-6 pt-5 sm:px-6 sm:pb-8 sm:pt-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,230,118,0.10),transparent_55%)] light-hide-hue-overlay" />

            <div className="relative flex flex-col items-center gap-4">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <MatchStatusPill
                  phase={phase}
                  liveClockLabel={liveClockLabel}
                  voidLabel={voidLabel}
                />
                {eventName ? (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {sportBadge ? (
                      <Image
                        src={`/sports/${sportBadge}`}
                        alt=""
                        width={14}
                        height={14}
                        className="h-3.5 w-3.5 object-contain"
                      />
                    ) : (
                      <Trophy className="h-3 w-3 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{eventName}</span>
                  </span>
                ) : null}
              </div>

              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                <div className="flex flex-col items-center gap-2.5 text-center">
                  <div className="flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
                    <TeamFlagImage
                      countryName={match.team1Name}
                      dbFlag={match.team1Flag}
                      logoUrl={match.team1Logo}
                      imgClassName="h-16 w-auto max-w-[5rem] object-contain sm:h-20 sm:max-w-[6rem]"
                      emojiClassName="text-5xl leading-none sm:text-6xl"
                    />
                  </div>
                  <p className="font-display text-lg leading-tight tracking-wide text-foreground sm:text-2xl">
                    {match.team1Name}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-1 px-1">
                  {showLiveScore ? (
                    <p className="font-mono text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
                      {score1}
                      <span className="mx-1 text-muted-foreground">–</span>
                      {score2}
                    </p>
                  ) : (
                    <p className="font-display text-2xl tracking-wide text-muted-foreground sm:text-3xl">
                      VS
                    </p>
                  )}
                  {phase === 'upcoming' ? (
                    <div className="mt-1 text-center">
                      <FeaturedMatchCountdownDisplay
                        compact
                        {...kickoffCountdown}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col items-center gap-2.5 text-center">
                  <div className="flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
                    <TeamFlagImage
                      countryName={match.team2Name}
                      dbFlag={match.team2Flag}
                      logoUrl={match.team2Logo}
                      imgClassName="h-16 w-auto max-w-[5rem] object-contain sm:h-20 sm:max-w-[6rem]"
                      emojiClassName="text-5xl leading-none sm:text-6xl"
                    />
                  </div>
                  <p className="font-display text-lg leading-tight tracking-wide text-foreground sm:text-2xl">
                    {match.team2Name}
                  </p>
                </div>
              </div>

              {phase === 'final' && actualAdvancedTeamName ? (
                <p className="text-center text-sm text-muted-foreground">
                  Advanced:{' '}
                  <span className="font-medium text-foreground">
                    {actualAdvancedTeamName}
                  </span>
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <time dateTime={match.kickoffAt}>
                  {formatFeaturedKickoffLocal(match.kickoffAt)}
                </time>
                <span aria-hidden>·</span>
                <span>{roundLabel}</span>
              </div>
            </div>
          </section>

          <MatchHubPanels
            matchId={matchId}
            team1Name={match.team1Name}
            team2Name={match.team2Name}
            team1Flag={match.team1Flag}
            team2Flag={match.team2Flag}
            team1Logo={match.team1Logo}
            team2Logo={match.team2Logo}
            lockedAt={match.lockedAt}
            phase={phase}
            isLoggedIn={isLoggedIn}
            consensus={consensus}
            commonScores={commonScores}
            myPredictions={myPredictions}
            writablePools={writablePools}
            competitionPools={competitionPools}
            team1Form={team1Form}
            team2Form={team2Form}
            headToHead={headToHead}
            team1Players={team1Players}
            team2Players={team2Players}
            rostersLoading={rostersLoading}
            onPredictionSaved={onPredictionSaved}
          />
        </main>
      </div>
    </div>
  )
}
