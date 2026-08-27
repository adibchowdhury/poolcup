/**
 * Convert step-5 modal review from accordion → static two-column summary.
 */
import fs from 'fs'

const wizardPath = 'components/create/create-pool-wizard.tsx'
const cssPath = 'app/globals.css'

let src = fs.readFileSync(wizardPath, 'utf8')

// 1) Drop ChevronDown import
if (src.includes('ChevronDown')) {
  src = src.replace(/\n\s*ChevronDown,\n/, '\n')
}

// 2) Drop accordion state + reset effect
const stateStart = src.indexOf(
  '  /** Step-5 modal review accordion — single-open; null = all collapsed. */',
)
if (stateStart >= 0) {
  const effectEnd = src.indexOf('  }, [step])\n', stateStart)
  if (effectEnd < 0) throw new Error('accordion reset effect end not found')
  const cutEnd = effectEnd + '  }, [step])\n'.length
  src = src.slice(0, stateStart) + src.slice(cutEnd)
  console.log('removed accordion state+effect')
} else {
  console.log('accordion state already absent')
}

function findBlockEnd(s, openIdx) {
  const braceStart = s.indexOf('{', openIdx)
  let depth = 0
  for (let i = braceStart; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  throw new Error('unclosed block')
}

const branchStart = src.indexOf('    if (embedScoringRules) {')
if (branchStart < 0) throw new Error('embedScoringRules branch not found')
const branchEnd = findBlockEnd(src, branchStart)

const newBranch = `    if (embedScoringRules) {
      const competitionPrimary = selectedEvent
        ? (() => {
            const { leagueName, seasonLabel } =
              formatCreateFlowCompetitionDisplay(selectedEvent)
            return seasonLabel ? \`\${leagueName} · \${seasonLabel}\` : leagueName
          })()
        : '—'
      const ballSrc =
        (selectedSport &&
          SPORTS.find((row) => row.id === selectedSport)?.imageSrc) ??
        '/sports/soccer.png'
      const normalizedDescription = normalizePoolDescription(poolDescription)
      const poolNameDisplay = normalizePoolName(poolName) || '—'

      const renderCompetitionLogo = () =>
        selectedEvent ? (
          <CreatePoolReviewCompetitionLogo
            logoUrl={normalizeTeamLogoUrl(selectedEvent.logo_url)}
            ballSrc={ballSrc}
            provider={selectedEvent.provider}
            providerLeagueId={selectedEvent.provider_league_id}
          />
        ) : (
          <span className="create-pool-review-crest" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ballSrc}
              alt=""
              width={22}
              height={22}
              className="create-pool-review-crest-img create-pool-review-crest-img--fallback"
              draggable={false}
            />
          </span>
        )

      const renderSportBall = () => (
        <span className="create-pool-review-crest" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ballSrc}
            alt=""
            width={22}
            height={22}
            className="create-pool-review-crest-img create-pool-review-crest-img--fallback"
            draggable={false}
          />
        </span>
      )

      const fieldRow = (label, value) => (
        <div className="create-pool-review-summary__row">
          <dt className="create-pool-review-summary__label">{label}</dt>
          <dd className="create-pool-review-summary__value">{value}</dd>
        </div>
      )

      return (
        <div
          data-testid="create-pool-review-summary"
          className={cn(
            'create-pool-review-summary--modal mx-auto w-full overflow-hidden rounded-xl border border-[#2a2a2a]',
            compact ? 'mt-4' : 'mt-6',
          )}
        >
          <section className="create-pool-review-summary__section">
            <header className="create-pool-review-summary__heading">
              <span
                className="create-pool-review-summary__heading-icon"
                aria-hidden
              >
                {renderCompetitionLogo()}
              </span>
              <h3 className="create-pool-review-summary__heading-title">
                Competition
              </h3>
            </header>
            <dl className="create-pool-review-summary__fields">
              {fieldRow(
                'Sport',
                <span className="create-pool-review-summary__value-inline">
                  {renderSportBall()}
                  <span>{formatReviewSportLabel(selectedSport)}</span>
                </span>,
              )}
              {fieldRow(
                'Competition / Event',
                <span className="create-pool-review-summary__value-inline">
                  {renderCompetitionLogo()}
                  <span className="min-w-0">
                    {competitionPrimary}
                  </span>
                </span>,
              )}
            </dl>
          </section>

          <section className="create-pool-review-summary__section">
            <header className="create-pool-review-summary__heading">
              <span
                className="create-pool-review-summary__heading-icon"
                aria-hidden
              >
                {scoringStyle === 'winner' ? (
                  <WinnerOnlyModeIcon className="h-5 w-5 text-[#5a7080]" />
                ) : (
                  <ScorePredictorModeIcon className="h-5 w-5 text-[#5a7080]" />
                )}
              </span>
              <h3 className="create-pool-review-summary__heading-title">
                Pool Type
              </h3>
            </header>
            <dl className="create-pool-review-summary__fields">
              {fieldRow(
                'Pool Type',
                <span>{selectedScoring?.label ?? scoringStyle}</span>,
              )}
            </dl>
            {selectedScoring ? (
              <ul
                className="create-pool-review-summary__scoring"
                aria-label="Scoring rules"
              >
                {selectedScoring.scoringRows.map((row) => (
                  <li key={row.id}>
                    <span aria-hidden>
                      {row.id === 'exact'
                        ? '🎯'
                        : row.id === 'winner'
                          ? '✓'
                          : '🤝'}
                    </span>
                    <span>
                      {row.id === 'exact'
                        ? 'Exact'
                        : row.id === 'winner'
                          ? 'Winner'
                          : 'Draw'}
                    </span>
                    <span className={modalPointsClass}>
                      {row.points.replace(/\\s*pts$/i, '')}
                    </span>
                  </li>
                ))}
                <li>
                  <span aria-hidden>×</span>
                  <span>Miss</span>
                  <span className={modalPointsClass}>+0</span>
                </li>
              </ul>
            ) : null}
          </section>

          <section className="create-pool-review-summary__section">
            <header className="create-pool-review-summary__heading">
              <span
                className="create-pool-review-summary__heading-icon"
                aria-hidden
              >
                <Users className="h-4 w-4 text-[#5a7080]" strokeWidth={1.75} />
              </span>
              <h3 className="create-pool-review-summary__heading-title">
                Pool Details
              </h3>
            </header>
            <dl className="create-pool-review-summary__fields">
              {fieldRow(
                'Pool Name',
                <span>{poolNameDisplay}</span>,
              )}
              {fieldRow(
                'Description',
                <span
                  className={cn(
                    !normalizedDescription &&
                      'italic font-normal text-[#8b98a9]',
                  )}
                >
                  {normalizedDescription || 'No description'}
                </span>,
              )}
              {fieldRow(
                'Visibility',
                <span className="create-pool-review-summary__value-inline">
                  {isPublic ? (
                    <Globe
                      className="h-3.5 w-3.5 shrink-0 text-[#22d3ee]"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : (
                    <Lock
                      className="h-3.5 w-3.5 shrink-0 text-[#a78bfa]"
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                  <span>{isPublic ? 'Public' : 'Private'}</span>
                </span>,
              )}
            </dl>
          </section>

          <section className="create-pool-review-summary__section">
            <header className="create-pool-review-summary__heading">
              <span
                className="create-pool-review-summary__heading-icon"
                aria-hidden
              >
                {selectedPlan === 'custom' ? (
                  <Flame
                    className="h-4 w-4 text-[#f2c94c]"
                    strokeWidth={1.75}
                  />
                ) : (
                  <CircleCheck
                    className="h-4 w-4 text-primary/70"
                    strokeWidth={1.75}
                  />
                )}
              </span>
              <h3 className="create-pool-review-summary__heading-title">
                Pool Experience
              </h3>
            </header>
            <dl className="create-pool-review-summary__fields">
              {fieldRow(
                'Plan',
                <span className="create-pool-review-summary__value-inline">
                  {selectedPlan === 'custom' ? (
                    <Flame
                      className="h-3.5 w-3.5 shrink-0 text-[#f2c94c]"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  ) : null}
                  <span>
                    {selectedPlan === 'custom' ? 'Custom Pool' : 'Basic Pool'}
                  </span>
                </span>,
              )}
              {fieldRow(
                'Price',
                selectedPlan === 'custom' ? (
                  <span className="text-[#f2c94c]">$9.99 one-time</span>
                ) : (
                  <span>Free</span>
                ),
              )}
            </dl>
          </section>
        </div>
      )
    }`

src = src.slice(0, branchStart) + newBranch + src.slice(branchEnd)
fs.writeFileSync(wizardPath, src)
console.log('wizard updated')

let css = fs.readFileSync(cssPath, 'utf8')

// Remove old summary max-width + entire accordion block through crest
const summaryRule = css.indexOf(
  '.create-pool-wizard--modal .create-pool-review-summary--modal',
)
const accordionComment = css.indexOf('/* Step-5 review accordion')
const crestRule = css.indexOf('.create-pool-review-crest {')
if (summaryRule < 0 || crestRule < 0) {
  throw new Error(
    `css anchors missing summary=${summaryRule} crest=${crestRule}`,
  )
}
const cutFrom = Math.min(
  summaryRule,
  accordionComment >= 0 ? accordionComment : summaryRule,
)

const newCss = `/* Step-5 modal review card — static summary; lighter than ticket body #111. */
.create-pool-wizard--modal .create-pool-review-summary--modal {
  max-width: 28.75rem; /* 460px */
  background: #1c1c1c;
}

.create-pool-review-summary__section {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #2a2a2a;
}

.create-pool-review-summary__section:last-child {
  border-bottom: 0;
}

.create-pool-review-summary__heading {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin: 0 0 0.625rem;
}

.create-pool-review-summary__heading-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
}

.create-pool-review-summary__heading-title {
  margin: 0;
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.25;
  color: #e8edf3;
}

.create-pool-review-summary__fields {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0;
}

.create-pool-review-summary__row {
  display: grid;
  grid-template-columns: minmax(6.5rem, 38%) minmax(0, 1fr);
  align-items: start;
  gap: 0.75rem;
}

.create-pool-review-summary__label {
  margin: 0;
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.35;
  color: #8b98a9;
}

.create-pool-review-summary__value {
  margin: 0;
  min-width: 0;
  text-align: right;
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.35;
  color: #e8edf3;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.create-pool-review-summary__value-inline {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: flex-end;
  gap: 0.375rem;
  text-align: right;
}

.create-pool-review-summary__scoring {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  margin: 0.375rem 0 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 0.75rem;
  line-height: 1.3;
  color: #8b98a9;
}

.create-pool-review-summary__scoring li {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 0.375rem;
}

`

css = css.slice(0, cutFrom) + newCss + css.slice(crestRule)
fs.writeFileSync(cssPath, css)
console.log('css updated')

const out = fs.readFileSync(wizardPath, 'utf8')
console.log({
  accordionGone: !out.includes('create-pool-review-accordion'),
  chevronGone: !out.includes('ChevronDown'),
  stateGone: !out.includes('reviewAccordionSection'),
  summaryPresent: out.includes('create-pool-review-summary__section'),
  mutedDescGone: !out.includes('Your sport and competition'),
})
