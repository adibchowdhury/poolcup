'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { SportingEvent } from '@/src/lib/current-event'
import { formatOfficialSeasonLabel } from '@/src/lib/fetch-official-pools'
import {
  normalizeSportKey,
  sportBallPublicPath,
} from '@/src/lib/sport-display'
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
  season: string | null
  dates: string
  inSeason: boolean
}

function formatShortRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start && !end) return null
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }
  const a = start ? fmt(start) : null
  const b = end ? fmt(end) : null
  if (a && b) return `${a} — ${b}`
  if (a) return `From ${a}`
  if (b) return `Until ${b}`
  return null
}

/**
 * DB-only list: creatable events for this sport, in the order already applied by
 * listCreatableSportingEvents (live first → start_date → name).
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
      season: formatOfficialSeasonLabel(
        event.provider_season,
        event.start_date,
        event.end_date,
      ),
      dates: formatShortRange(event.start_date, event.end_date) ?? 'Dates TBA',
      inSeason: event.status === 'live',
    }))
}

export type CreateCompetitionStepProps = {
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

  const availableCount = rows.length

  return (
    <div className="create-competition-step">
      <p
        className={cn(
          'create-competition-step__subhead',
          headingStagger && 'create-mode-heading-stagger',
        )}
      >
        Choose a sport, then the competition your pool will follow. Fixtures
        and scoring sync automatically once the season starts.
      </p>

      <div className="create-competition-step__layout">
        <div className="create-competition-step__rail-col">
          <p className="create-competition-step__eyebrow">Sport</p>
          <div
            className="create-competition-step__rail"
            role="tablist"
            aria-label="Sports"
            style={{ marginTop: 8 }}
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
                    width={20}
                    height={20}
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
          <div className="create-competition-step__panel-header">
            <p className="create-competition-step__eyebrow">
              Competitions · {sportMeta.label}
            </p>
            <p className="create-competition-step__eyebrow">
              {String(availableCount).padStart(2, '0')} available
            </p>
          </div>

          {eventsLoading ? (
            <div className="create-competition-step__empty">
              Loading competitions…
            </div>
          ) : eventsError ? (
            <div className="create-competition-step__empty">
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
          ) : rows.length === 0 ? (
            <div className="create-competition-step__empty">
              No competitions available for {sportMeta.label} right now
            </div>
          ) : (
            <div className="create-competition-step__list">
              {rows.map((row) => {
                const pressed = row.eventId === selectedEventId
                return (
                  <button
                    key={row.key}
                    type="button"
                    aria-pressed={pressed}
                    className="create-competition-step__row"
                    onClick={() => onSelectEvent(row.eventId)}
                  >
                    <span className="create-competition-step__crest">
                      {/* No event logo on SportingEvent yet — sport ball fallback. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sportMeta.ballSrc}
                        alt=""
                        width={19}
                        height={19}
                        className="create-competition-step__crest-ball"
                        draggable={false}
                      />
                    </span>
                    <span className="create-competition-step__meta">
                      <span className="create-competition-step__name">
                        {row.name}
                      </span>
                      {row.season ? (
                        <span className="create-competition-step__season">
                          {row.season}
                        </span>
                      ) : null}
                    </span>
                    <span className="create-competition-step__right">
                      <span className="create-competition-step__dates">
                        {row.dates}
                      </span>
                      <span
                        className={cn(
                          'create-competition-step__status',
                          row.inSeason &&
                            'create-competition-step__status--in-season',
                        )}
                      >
                        <span
                          className="create-competition-step__dot"
                          aria-hidden
                        />
                        {row.inSeason ? 'In season' : 'Upcoming'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const CREATE_COMPETITION_SPORTS = SPORTS
