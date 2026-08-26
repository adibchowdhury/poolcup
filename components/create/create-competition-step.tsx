'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { SportingEvent } from '@/src/lib/current-event'
import {
  getCompetitionLogoBacking,
  shouldPreferSportBallFallback,
} from '@/src/lib/competition-logo-backing'
import {
  normalizeSportKey,
  sportBallPublicPath,
} from '@/src/lib/sport-display'
import { normalizeTeamLogoUrl } from '@/src/lib/team-logos'
import './create-competition-step.css'

export type CreateCompetitionSportId =
  | 'soccer'
  | 'basketball'
  | 'baseball'
  | 'football'
  | 'hockey'

const SPORT_KEY: Record<CreateCompetitionSportId, string> = {
  soccer: 'football',
  basketball: 'basketball',
  baseball: 'baseball',
  football: 'american_football',
  hockey: 'hockey',
}

/** PoolCup sport-ball PNGs under /public/sports (same as Discover / bubbles). */
const SPORTS: {
  id: CreateCompetitionSportId
  label: string
  ballSrc: string
}[] = [
  {
    id: 'soccer',
    label: 'Soccer',
    ballSrc: sportBallPublicPath('soccer')!,
  },
  {
    id: 'basketball',
    label: 'Basketball',
    ballSrc: sportBallPublicPath('basketball')!,
  },
  {
    id: 'baseball',
    label: 'Baseball',
    ballSrc: sportBallPublicPath('baseball')!,
  },
  {
    id: 'football',
    label: 'Football',
    ballSrc: sportBallPublicPath('american_football')!,
  },
  {
    id: 'hockey',
    label: 'Hockey',
    ballSrc: sportBallPublicPath('hockey')!,
  },
]

type CompetitionRow = {
  key: string
  eventId: string
  name: string
  logoUrl: string | null
  provider: string | null
  providerLeagueId: string | null
  inSeason: boolean
}

/**
 * DB-only list: creatable events for this sport.
 * Sorted in-season first, then upcoming (name within each group).
 */
function buildRows(
  sport: CreateCompetitionSportId,
  events: SportingEvent[],
): CompetitionRow[] {
  const sportKey = SPORT_KEY[sport]
  return events
    .filter((event) => normalizeSportKey(event.sport) === sportKey)
    .map((event) => ({
      key: event.id,
      eventId: event.id,
      name: event.name,
      logoUrl: normalizeTeamLogoUrl(event.logo_url),
      provider: event.provider,
      providerLeagueId: event.provider_league_id,
      inSeason: event.status === 'live',
    }))
    .sort((a, b) => {
      if (a.inSeason !== b.inSeason) return a.inSeason ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

function CompetitionLeagueLogo({
  logoUrl,
  ballSrc,
  provider,
  providerLeagueId,
  className,
}: {
  logoUrl: string | null
  ballSrc: string
  provider: string | null
  providerLeagueId: string | null
  className?: string
}) {
  const [loadFailed, setLoadFailed] = useState(false)
  const forceBall = shouldPreferSportBallFallback(provider, providerLeagueId)
  const backing = getCompetitionLogoBacking(provider, providerLeagueId)
  const useLeagueLogo = Boolean(logoUrl) && !loadFailed && !forceBall
  const src = useLeagueLogo ? logoUrl! : ballSrc

  useEffect(() => {
    setLoadFailed(false)
  }, [logoUrl, provider, providerLeagueId])

  const img = (
    /* eslint-disable-next-line @next/next/no-img-element -- api-sports CDN + /public fallback */
    <img
      src={src}
      alt=""
      width={28}
      height={28}
      className={cn(
        'create-competition-step__crest-img',
        useLeagueLogo
          ? 'create-competition-step__crest-img--league'
          : 'create-competition-step__crest-img--fallback',
      )}
      style={
        useLeagueLogo && backing?.logoFilter
          ? { filter: backing.logoFilter }
          : undefined
      }
      draggable={false}
      onError={() => setLoadFailed(true)}
      onLoad={(event) => {
        const el = event.currentTarget
        if (el.naturalWidth === 0 || el.naturalHeight === 0) {
          setLoadFailed(true)
        }
      }}
    />
  )

  return (
    <span className={cn('create-competition-step__crest', className)}>
      {backing && useLeagueLogo ? (
        <span
          className="create-competition-step__crest-backing"
          style={{
            backgroundColor: backing.circleColor,
            border: backing.circleBorder,
          }}
        >
          {img}
        </span>
      ) : (
        img
      )}
    </span>
  )
}

function CompetitionTile({
  row,
  pressed,
  ballSrc,
  onSelect,
}: {
  row: CompetitionRow
  pressed: boolean
  ballSrc: string
  onSelect: (eventId: string) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className="create-competition-step__row"
      onClick={() => onSelect(row.eventId)}
    >
      <span
        className={cn(
          'create-competition-step__status create-competition-step__status--badge',
          row.inSeason && 'create-competition-step__status--in-season',
        )}
      >
        {row.inSeason ? (
          <span
            className="stage-live-dot-light h-1.5 w-1.5 shrink-0 rounded-full"
            aria-hidden
          />
        ) : (
          <span className="create-competition-step__dot" aria-hidden />
        )}
        {row.inSeason ? 'In season' : 'Upcoming'}
      </span>

      <div className="create-competition-step__card-body">
        <div className="create-competition-step__title-row">
          <CompetitionLeagueLogo
            logoUrl={row.logoUrl}
            ballSrc={ballSrc}
            provider={row.provider}
            providerLeagueId={row.providerLeagueId}
          />
          <span className="create-competition-step__name">{row.name}</span>
        </div>
      </div>
    </button>
  )
}

export type CreateCompetitionStepProps = {
  /** Desktop modal: stacked chips + 2-col tiles. Page/mobile: rail or chip row. */
  layoutMode?: 'page' | 'modal'
  selectedSport: CreateCompetitionSportId | null
  selectedEventId: string | null
  creatableEvents: SportingEvent[]
  eventsLoading: boolean
  eventsError: string | null
  headingStagger?: boolean
  onSelectSport: (sport: CreateCompetitionSportId) => void
  onSelectEvent: (eventId: string) => void
  onRetryLoad: () => void
}

export function CreateCompetitionStep({
  layoutMode = 'page',
  selectedSport,
  selectedEventId,
  creatableEvents,
  eventsLoading,
  eventsError,
  headingStagger,
  onSelectSport,
  onSelectEvent,
  onRetryLoad,
}: CreateCompetitionStepProps) {
  const activeSport = selectedSport ?? 'soccer'
  const sportMeta = SPORTS.find((row) => row.id === activeSport) ?? SPORTS[0]!

  const rows = useMemo(
    () => buildRows(activeSport, creatableEvents),
    [activeSport, creatableEvents],
  )

  const inSeasonRows = useMemo(
    () => rows.filter((row) => row.inSeason),
    [rows],
  )
  const upcomingRows = useMemo(
    () => rows.filter((row) => !row.inSeason),
    [rows],
  )
  const showGroupHeadings =
    inSeasonRows.length > 0 && upcomingRows.length > 0

  const availableCount = rows.length

  const renderCompetitionList = () => {
    if (eventsLoading) {
      return (
        <div
          key={`${activeSport}-loading`}
          className="create-competition-step__empty create-mode-competition-swap"
        >
          Loading competitions…
        </div>
      )
    }
    if (eventsError) {
      return (
        <div
          key={`${activeSport}-error`}
          className="create-competition-step__empty create-mode-competition-swap"
        >
          <div>
            <p>{eventsError}</p>
            <button
              type="button"
              className="create-competition-step__cta"
              style={{ marginTop: 14 }}
              onClick={onRetryLoad}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    if (rows.length === 0) {
      return (
        <div
          key={`${activeSport}-empty`}
          className="create-competition-step__empty create-mode-competition-swap"
        >
          No competitions available for {sportMeta.label} right now
        </div>
      )
    }

    return (
      <div
        key={`${activeSport}-list`}
        className="create-competition-step__list create-mode-competition-swap"
      >
        {inSeasonRows.length > 0 ? (
          <>
            {showGroupHeadings && layoutMode !== 'modal' ? (
              <p className="create-competition-step__group-heading">In Season</p>
            ) : null}
            {inSeasonRows.map((row) => (
              <CompetitionTile
                key={row.key}
                row={row}
                pressed={row.eventId === selectedEventId}
                ballSrc={sportMeta.ballSrc}
                onSelect={onSelectEvent}
              />
            ))}
          </>
        ) : null}
        {upcomingRows.length > 0 ? (
          <>
            {showGroupHeadings && layoutMode !== 'modal' ? (
              <p className="create-competition-step__group-heading">Upcoming</p>
            ) : null}
            {upcomingRows.map((row) => (
              <CompetitionTile
                key={row.key}
                row={row}
                pressed={row.eventId === selectedEventId}
                ballSrc={sportMeta.ballSrc}
                onSelect={onSelectEvent}
              />
            ))}
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'create-competition-step',
        layoutMode === 'modal' && 'create-competition-step--modal',
      )}
    >
      {layoutMode !== 'modal' ? (
        <p
          className={cn(
            'create-competition-step__subhead',
            headingStagger && 'create-mode-heading-stagger',
          )}
        >
          What are you predicting?
        </p>
      ) : null}

      <div className="create-competition-step__layout">
        <div className="create-competition-step__rail-col">
          <div
            className="create-competition-step__rail"
            role="tablist"
            aria-label="Sports"
          >
            {SPORTS.map((sport) => {
              const selected = activeSport === sport.id
              return (
                <button
                  key={sport.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="create-competition-panel"
                  id={`create-sport-${sport.id}`}
                  className="create-competition-step__sport"
                  onClick={() => onSelectSport(sport.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static /public/sports PNG; matches sport-bubbles-row */}
                  <img
                    src={sport.ballSrc}
                    alt=""
                    width={28}
                    height={28}
                    className="create-competition-step__sport-ball"
                    draggable={false}
                  />
                  <span className="create-competition-step__sport-label">
                    {sport.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div
          id="create-competition-panel"
          role="tabpanel"
          aria-labelledby={`create-sport-${activeSport}`}
          className="create-competition-step__panel"
        >
          {layoutMode !== 'modal' ? (
            <div className="create-competition-step__panel-header">
              <p className="create-competition-step__eyebrow">
                Competitions · {sportMeta.label}
              </p>
              <p className="create-competition-step__eyebrow">
                {String(availableCount).padStart(2, '0')} available
              </p>
            </div>
          ) : null}

          {renderCompetitionList()}
        </div>
      </div>
    </div>
  )
}

export const CREATE_COMPETITION_SPORTS = SPORTS
