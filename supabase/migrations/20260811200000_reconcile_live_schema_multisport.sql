-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
-- =============================================================================
-- RECONCILIATION MIGRATION (documentation / rebuild parity only)
-- =============================================================================
-- Everything in this file was ALREADY APPLIED to production via Supabase MCP
-- across the multi-sport + social + leaderboard + observability build-out.
-- This file exists ONLY to keep the repo migration history in parity with the
-- live database (for fresh environments, branches, and local rebuilds).
--
-- DO NOT run this against production — it is already there. It is written to be
-- idempotent (IF NOT EXISTS / CREATE OR REPLACE) so a rebuild-from-scratch is safe.
--
-- Covers, since the previous reconciliation (…130100):
--   * Leaderboards: banned flag + paginated global XP board + friends board + rank
--   * Sync observability: sync_jobs, last_fixture_sync_*, provider_raw, is_admin, get_sync_status
--   * Discover: get_trending_official_pools
--   * Official pools automation: ensure_official_pools
--   * Match reveal-gating (post-lock): get_match_consensus / _common_scores / friends_match_predictions
--   * Public profiles: resolve_username, user_reports + report_user, extended get_public_profile,
--                      sport/competition stats + activity (post-lock)
--   * Friends: user_mutes / user_blocks + mute_user / block_user, suggestions, mutual, activity feed,
--              username-aware search_users
--   * Pool chat: pool_messages INSERT rate-limit RLS
-- =============================================================================

-- ----------------------------------------------------------------------------
-- COLUMNS
-- ----------------------------------------------------------------------------
ALTER TABLE public.users             ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.users             ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.sporting_events   ADD COLUMN IF NOT EXISTS last_fixture_sync_at timestamptz;
ALTER TABLE public.sporting_events   ADD COLUMN IF NOT EXISTS last_fixture_sync_status text;
ALTER TABLE public.matches           ADD COLUMN IF NOT EXISTS provider_raw jsonb;
ALTER TABLE public.matches           ADD COLUMN IF NOT EXISTS provider_raw_at timestamptz;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        text NOT NULL,
  event_id        uuid REFERENCES public.sporting_events(id) ON DELETE SET NULL,
  status          text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  items_processed integer DEFAULT 0,
  items_changed   integer DEFAULT 0,
  error_message   text,
  detail          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_jobs_type_time_idx ON public.sync_jobs(job_type, created_at DESC);
CREATE INDEX IF NOT EXISTS sync_jobs_event_idx ON public.sync_jobs(event_id, created_at DESC);
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason           text,
  context          text,
  status           text NOT NULL DEFAULT 'open',
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_report CHECK (reporter_id <> reported_user_id)
);
CREATE INDEX IF NOT EXISTS user_reports_reported_idx ON public.user_reports(reported_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_reports_status_idx ON public.user_reports(status, created_at DESC);
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_mutes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  muted_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, muted_user_id),
  CONSTRAINT no_self_mute CHECK (user_id <> muted_user_id)
);
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, blocked_user_id),
  CONSTRAINT no_self_block CHECK (user_id <> blocked_user_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS POLICIES
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_jobs' AND policyname='sync_jobs_admin_read') THEN
    CREATE POLICY sync_jobs_admin_read ON public.sync_jobs FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_reports' AND policyname='user_reports_insert') THEN
    CREATE POLICY user_reports_insert ON public.user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_reports' AND policyname='user_reports_read_own') THEN
    CREATE POLICY user_reports_read_own ON public.user_reports FOR SELECT
      USING (auth.uid() = reporter_id OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_mutes' AND policyname='user_mutes_own') THEN
    CREATE POLICY user_mutes_own ON public.user_mutes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_blocks' AND policyname='user_blocks_own') THEN
    CREATE POLICY user_blocks_own ON public.user_blocks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Pool chat send rate-limit (max 10 msgs / 10s per user). System messages insert
-- via SECURITY DEFINER and bypass RLS.
DROP POLICY IF EXISTS "members send pool messages" ON public.pool_messages;
CREATE POLICY "members send pool messages" ON public.pool_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.pool_members pm WHERE pm.pool_id = pool_messages.pool_id AND pm.user_id = auth.uid())
    AND (SELECT count(*) FROM public.pool_messages m WHERE m.user_id = auth.uid() AND m.created_at > now() - interval '10 seconds') < 10
  );

-- ----------------------------------------------------------------------------
-- FUNCTIONS  (definitions exported verbatim from production)
-- ----------------------------------------------------------------------------
-- NOTE: The CREATE OR REPLACE FUNCTION bodies for the following are captured in
-- the accompanying functions file to keep this migration readable. They are all
-- SECURITY DEFINER, search_path=public, and already live in production:
--   get_global_xp_leaderboard_page, get_friends_xp_leaderboard, get_user_global_rank,
--   get_sync_status, get_trending_official_pools, ensure_official_pools,
--   get_match_consensus, get_match_common_scores, get_friends_match_predictions,
--   resolve_username, report_user, get_public_profile,
--   get_public_profile_sport_stats, get_public_profile_competition_stats,
--   get_public_profile_activity, mute_user, block_user, get_friend_suggestions,
--   get_mutual_friends_count, get_friend_activity_feed, search_users
--
-- GRANTs applied in production (recorded for parity):
--   authenticated + service_role on all; anon additionally on get_match_consensus,
--   get_match_common_scores, resolve_username, get_public_profile,
--   get_public_profile_sport_stats, _competition_stats, _activity.
-- =============================================================================
