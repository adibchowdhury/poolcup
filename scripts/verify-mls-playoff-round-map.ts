/**
 * Dev-only mapping checks for MLS playoff rounds (league 253).
 * Run: npx tsx scripts/verify-mls-playoff-round-map.ts
 */
import { mapProviderRound } from '../src/lib/api-football-round-map'
import { isTournamentStyleMatches } from '../src/lib/classic-round-tab-logic'
import {
  API_FOOTBALL_MLS_LEAGUE_ID,
  groupMlsPlayoffMatchesByStage,
  mapMlsApiRoundToCode,
  MLS_PLAYOFF_ROUND_LABELS,
} from '../src/lib/mls-playoff-rounds'

let failed = 0

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    failed += 1
    console.error(`FAIL ${label}: got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`)
    return
  }
  console.log(`ok  ${label}`)
}

function assertTrue(value: boolean, label: string) {
  if (!value) {
    failed += 1
    console.error(`FAIL ${label}`)
    return
  }
  console.log(`ok  ${label}`)
}

const MLS_CASES: Array<{ label: string; expected: string; unmapped?: boolean }> = [
  { label: 'Regular Season - 1', expected: 'league' },
  { label: 'Regular Season - 34', expected: 'league' },
  { label: '', expected: 'league' },
  { label: 'Wild Card', expected: 'po_wildcard' },
  { label: 'MLS Wild-Card Round', expected: 'po_wildcard' },
  { label: 'Wildcard Playoff', expected: 'po_wildcard' },
  { label: 'Round One', expected: 'po_r1' },
  { label: 'First Round', expected: 'po_r1' },
  { label: 'MLS Cup Playoffs - Round 1', expected: 'po_r1' },
  { label: 'Conference Semifinals', expected: 'po_conf_sf' },
  { label: 'Eastern Conference Semi-finals', expected: 'po_conf_sf' },
  { label: 'Conference Finals', expected: 'po_conf_final' },
  { label: 'Western Conference Final', expected: 'po_conf_final' },
  { label: 'MLS Cup', expected: 'po_final' },
  { label: 'Final', expected: 'po_final' },
  { label: 'Play-In Tournament', expected: 'league', unmapped: true },
]

console.log('--- mapMlsApiRoundToCode ---')
for (const test of MLS_CASES) {
  const mapped = mapMlsApiRoundToCode(test.label)
  assertEqual(mapped.round, test.expected, `"${test.label}" → ${test.expected}`)
  assertEqual(
    mapped.unmapped,
    test.unmapped === true,
    `"${test.label}" unmapped=${test.unmapped === true}`,
  )
}

console.log('--- mapProviderRound MLS 253 vs other leagues ---')
assertEqual(
  mapProviderRound(API_FOOTBALL_MLS_LEAGUE_ID, 'Conference Semifinals').round,
  'po_conf_sf',
  'MLS 253 Conference Semifinals',
)
assertEqual(
  mapProviderRound(API_FOOTBALL_MLS_LEAGUE_ID, 'Regular Season - 12').round,
  'league',
  'MLS 253 regular season',
)
assertEqual(mapProviderRound(API_FOOTBALL_MLS_LEAGUE_ID, 'Play-In').skip, false, 'MLS never skip')
assertEqual(
  mapProviderRound(39, 'Conference Semifinals').round,
  'league',
  'Premier League still league',
)
assertEqual(mapProviderRound(1, 'Round of 16').round, 'r16', 'WC mapping unchanged')
assertEqual(mapProviderRound(2, 'Quarter-finals').round, 'cl_qf', 'CL mapping unchanged')

console.log('--- layout detection ---')
assertTrue(
  !isTournamentStyleMatches([{ round: 'league' }, { round: 'po_final' }]),
  'po_* does not flip tournament mode',
)
assertTrue(
  isTournamentStyleMatches([{ round: 'group' }, { round: 'po_final' }]),
  'WC group still tournament even if po_* mixed in',
)

const stages = groupMlsPlayoffMatchesByStage(
  [
    { round: 'po_final', id: 'cup' },
    { round: 'po_wildcard', id: 'wc' },
    { round: 'league', id: 'reg' },
    { round: 'po_r1', id: 'r1' },
  ],
  () => 0,
)
assertEqual(
  stages.map((s) => s.round).join(','),
  'po_wildcard,po_r1,po_final',
  'stage order Wild Card → Round One → MLS Cup',
)
assertEqual(stages[0]?.label, MLS_PLAYOFF_ROUND_LABELS.po_wildcard, 'wildcard label')

const SCORING_KNOCKOUT = new Set(['r32', 'r16', 'qf', 'sf', 'third', 'final'])
for (const code of ['po_wildcard', 'po_r1', 'po_conf_sf', 'po_conf_final', 'po_final']) {
  assertTrue(!SCORING_KNOCKOUT.has(code), `${code} not in calculate_match_points knockout set`)
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll MLS playoff mapping checks passed')
