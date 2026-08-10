# Soccer data pipeline (API-Football)

PoolCup’s primary sport data comes from **API-Football** ([api-sports.io](https://www.api-sports.io/) / `v3.football.api-sports.io`).

## Environment

| Variable | Purpose |
|----------|---------|
| `API_FOOTBALL_KEY` | Provider API key (`x-apisports-key`) |
| `CRON_SECRET` | Bearer / `x-cron-secret` auth for cron routes |
| `NTFY_OPS_TOPIC` / `NTFY_SERVER` / `NTFY_AUTH_TOKEN` | Ops alerts on sync failures (optional) |
| `NEXT_PUBLIC_SUPABASE_URL` / keys | Database |

## League mapping

Rows in `sporting_events` with:

- `provider = 'api-football'`
- `provider_league_id` (API league id, e.g. `39` Premier League, `1` World Cup, `2` CL)
- `provider_season` (API season year)
- `status IN ('live','upcoming')`

…are picked up by automated fixture sync. Round mapping:

- Domestic leagues → `matches.round = 'league'`
- World Cup (league `1`) → `group` / `r32` / `r16` / `qf` / `sf` / `third` / `final` via `mapLeagueRoundToGroup`
- Champions League (league `2`) → `cl_*` codes via `mapClApiRoundToCode`

Provider fixture id is stored on `matches.fixture_id` (UNIQUE). Raw payloads are archived on `matches.provider_raw` / `provider_raw_at`.

## Crons (`vercel.json`)

| Path | Cadence | Job |
|------|---------|-----|
| `/api/cron/sync-fixtures` | **Every 6 hours** (`0 */6 * * *`) | Upcoming + reschedule fixture upsert per mapped event |
| `/api/sync-scores` | Every minute | Live scores + finalize → `calculate_match_points` |
| `/api/reconcile-stale-matches` | Every 15 minutes | Stale live / corrected finals |
| `/api/sync-knockout-round-rows` | Every 5 minutes | WC knockout slot fill |
| `/api/cron/refresh-rosters` | Mondays 06:00 UTC | Team squad refresh |

All cron routes require `Authorization: Bearer $CRON_SECRET` (or `x-cron-secret`).

Manual bootstrap scripts (`scripts/league-ingest.ts`, `scripts/cl-ingest.ts`, `scripts/seed-matches.ts`) remain for one-off seeding; **ongoing** fixture ingestion is `sync-fixtures`.

## Lifecycle

1. **Fixtures** — `sync-fixtures` upserts matches (kickoff, teams, logos, round, `provider_raw`).
2. **Live** — `sync-scores` polls `fixture_id`s in the live window; updates score/status.
3. **Final** — on `FT` / `AET` / `PEN`, scores lock and **`calculate_match_points`** runs (do not edit that RPC from this pipeline).
4. **Leaderboard** — pool `leaderboard_cache` rebuilt by scoring; UI reads cache.
5. **Observability** — each run writes `sync_jobs`; event stamp `last_fixture_sync_at` / `last_fixture_sync_status`; admin UI at `/admin/sync` (`users.is_admin`, `get_sync_status()`).

## Admin retry

`/admin/sync` (admins only) shows last status per job/event and can re-trigger crons server-side via `/api/admin/sync/retry` (uses `CRON_SECRET` internally — no curl required).
