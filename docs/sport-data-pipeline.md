# Sport data pipeline

PoolCup ingests fixtures and live scores from **api-sports.io** (All-Sports plan). Soccer and baseball share the same `API_FOOTBALL_KEY` (`x-apisports-key`).

---

## Environment

| Variable | Purpose |
|----------|---------|
| `API_FOOTBALL_KEY` | Provider API key for **all** api-sports products (soccer, baseball, NFL, basketball, …) |
| `CRON_SECRET` | Bearer / `x-cron-secret` auth for cron routes |
| `NTFY_OPS_TOPIC` / `NTFY_SERVER` / `NTFY_AUTH_TOKEN` | Ops alerts on sync failures (optional) |
| `NEXT_PUBLIC_SUPABASE_URL` / keys | Database |

---

## Soccer (API-Football)

Primary soccer provider: `v3.football.api-sports.io`.

### League mapping

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

### Soccer crons

| Path | Cadence | Job |
|------|---------|-----|
| `/api/cron/sync-fixtures` | Every 6 hours (`0 */6 * * *`) | Upcoming + reschedule fixture upsert per mapped event |
| `/api/sync-scores` | Every minute | Live scores + finalize → `calculate_match_points` |
| `/api/reconcile-stale-matches` | Every 15 minutes | Stale live / corrected finals |
| `/api/sync-knockout-round-rows` | Every 5 minutes | WC knockout slot fill |
| `/api/cron/refresh-rosters` | Mondays 06:00 UTC | Team squad refresh |

Manual bootstrap scripts (`scripts/league-ingest.ts`, `scripts/cl-ingest.ts`, `scripts/seed-matches.ts`) remain for one-off seeding; **ongoing** fixture ingestion is `sync-fixtures`.

### Soccer lifecycle

1. **Fixtures** — `sync-fixtures` upserts matches (kickoff, teams, logos, round, `provider_raw`).
2. **Live** — `sync-scores` polls `fixture_id`s in the live window; updates score/status.
3. **Final** — on `FT` / `AET` / `PEN`, scores lock and **`calculate_match_points`** runs (do not edit that RPC from this pipeline).
4. **Leaderboard** — pool `leaderboard_cache` rebuilt by scoring; UI reads cache.
5. **Observability** — each run writes `sync_jobs`; event stamp `last_fixture_sync_at` / `last_fixture_sync_status`; admin UI at `/admin/sync`.

---

## Baseball (API-Baseball / MLB)

Provider: **`v1.baseball.api-sports.io`** (`provider = 'api-baseball'`).

Auth reuses **`API_FOOTBALL_KEY`** (same All-Sports plan key).

### Competition mapping

| Field | MLB 2026 |
|-------|----------|
| `sport` | `baseball` |
| `provider` | `api-baseball` |
| `provider_league_id` | `1` (MLB) |
| `provider_season` | `2026` |
| `matches.round` | `regular` |

Code: `src/lib/api-baseball.ts`, `src/lib/sync-baseball.ts`.

Teams are stored on match rows (`team1_name` / `team2_name` + logos) — no separate baseball `teams` table.

### Status mapping

| Provider short | PoolCup `status_short` | Notes |
|----------------|------------------------|-------|
| `NS` | `NS` | Upcoming |
| `IN1`–`IN9` | same | Live innings |
| `IN0` | `IN0` | Extra innings (live) |
| `LIVE` / `BT` | same | Generic live / break |
| `FT` | `FT` | Final → `is_final` when totals present |
| `POST` | `PST` | Postponed (void set) |
| `CANC` / other | pass-through | Void handling via existing match void helpers |

Scores use `scores.home.total` / `scores.away.total` (includes extra-inning runs).

### Baseball crons

| Path | Cadence | Job type | Job |
|------|---------|----------|-----|
| `/api/cron/sync-baseball` | Every 6 hours (`0 */6 * * *`) | `sync_baseball` | Full-season fixture upsert + newly final scoring + official pools |
| `/api/cron/sync-baseball-live` | Every minute (`* * * * *`) | `sync_baseball_live` | **Cheap** poll: today's games by date (1 call), filter to in-window DB rows |

Live path skips the API when no baseball games are in the kickoff window. It fetches **by date** (`/games?league&season&date` — baseball does not support football-style `ids` batches), updates `status_short`, run totals, and `is_final`, then calls **`calculate_match_points`** only for newly finalized games (same RPC as soccer; do not edit it here).

### Baseball lifecycle

1. **Season sync** — upsert all league/season games; stamp `last_fixture_sync_*` on the event.
2. **Live** — minute cron polls only non-final baseball matches with recent kickoff.
3. **Final** — `FT` + totals → `is_final` → `calculate_match_points`.
4. **Official pools** — `ensureOfficialPoolsBestEffort` after season sync.

---

## American football / NFL (API-American-Football)

Provider: **`v1.american-football.api-sports.io`** (`provider = 'api-american-football'`).

Auth reuses **`API_FOOTBALL_KEY`**. Store events with `sport = 'american_football'` (not `football`) so the NFL bubble does not collide with soccer.

### Competition mapping

| Field | NFL 2026 |
|-------|----------|
| `sport` | `american_football` |
| `provider` | `api-american-football` |
| `provider_league_id` | `1` (NFL) |
| `provider_season` | `2026` |
| `matches.round` | `preseason` / `regular` / `playoff` (from `game.stage`) |

Code: `src/lib/api-american-football.ts`, `src/lib/sync-american-football.ts`.

### Status / score

- Final: `FT` / `AOT` + totals → `is_final`
- Live: `Q1`–`Q4`, `HT`, `OT`, `LIVE`, `BT`
- Upcoming: `NS`
- Postponed: `POST` → `PST`
- Points: `scores.home.total` / `scores.away.total` → `result_team1` / `result_team2`

### NFL crons

| Path | Cadence | Job type | Job |
|------|---------|----------|-----|
| `/api/cron/sync-american-football` | Every 6 hours | `sync_american_football` | Full-season fixture upsert + newly final scoring + official pools |
| `/api/cron/sync-american-football-live` | Every minute | `sync_american_football_live` | **Cheap** poll: today's games by date (1 call), filter to in-window DB rows |

Live path uses `/games?league&season&date` (american-football does not support football-style `ids` batches), same pattern as baseball.

---

## Basketball / NBA (API-Basketball)

Provider: **`v1.basketball.api-sports.io`** (`provider = 'api-basketball'`).

Auth reuses **`API_FOOTBALL_KEY`**. Store events with `sport = 'basketball'`.

### Competition mapping

| Field | NBA 2026-2027 |
|-------|---------------|
| `sport` | `basketball` |
| `provider` | `api-basketball` |
| `provider_league_id` | `12` (NBA) |
| `provider_season` | **`2026-2027`** (YYYY-YYYY **string**, not a year number) |
| `matches.round` | `regular` |

Code: `src/lib/api-basketball.ts`, `src/lib/sync-basketball.ts`.

Game payload is **flat** (top-level `id` / `date` / `status` / `teams` / `scores`) — not NFL's nested `game` object. `fixture_id` = top-level `id`.

### Status / score

- Final: `FT` / **`AOT`** (finished after overtime) + totals → `is_final` (`AOT` is **not** live)
- Live: `Q1`–`Q4`, `HT`, `OT`, `LIVE`, `BT`
- Upcoming: `NS`
- Postponed: `POST` → `PST`
- Points: `scores.home.total` / `scores.away.total` → `result_team1` / `result_team2` (OT field is `over_time`)
- No draws

### NBA crons

| Path | Cadence | Job type | Job |
|------|---------|----------|-----|
| `/api/cron/sync-basketball` | Every 6 hours (`0 */6 * * *`) | `sync_basketball` | Full-season fixture upsert + newly final scoring + official pools |
| `/api/cron/sync-basketball-live` | Every minute (`* * * * *`) | `sync_basketball_live` | **Cheap** poll: today's games by date (1 call), filter to in-window DB rows |

Live path uses `/games?league&season&date` with the **string** season (basketball does not support football-style `ids` batches). Season is passed through as-is (`2026-2027`).

### Basketball lifecycle

1. **Season sync** — upsert all league/season games; stamp `last_fixture_sync_*` on the event.
2. **Live** — minute cron polls only non-final basketball matches with recent tip-off.
3. **Final** — `FT` / `AOT` + totals → `is_final` → `calculate_match_points`.
4. **Official pools** — `ensureOfficialPoolsBestEffort` after season sync.

---

## Shared observability

All cron routes require `Authorization: Bearer $CRON_SECRET` (or `x-cron-secret`).

Each run writes `sync_jobs`. Admin UI at `/admin/sync` (`users.is_admin`, `get_sync_status()`) lists **all** job types (soccer, baseball, future sports) and can re-trigger known jobs via `/api/admin/sync/retry`.
