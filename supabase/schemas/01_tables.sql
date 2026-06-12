-- ============================================================
-- PoolCup — Database Schema Backup (1 of 2): TABLES
-- Snapshot of the live database (public schema) — 2026-06-12
-- Project: pyydeixbkzzyezjuqted
--
-- Contains: table definitions, constraints (PK/UNIQUE/FK/CHECK), and indexes.
-- Apply this file BEFORE 02_functions_policies_triggers.sql.
-- Note: foreign keys to auth.users(...) assume Supabase's auth schema exists.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    event_name text NOT NULL,
    user_id uuid,
    pool_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_predictions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pool_id uuid NOT NULL,
    member_id uuid NOT NULL,
    group_name character(1) NOT NULL,
    standings jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    points_awarded integer
);

CREATE TABLE IF NOT EXISTS public.issue_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    message text NOT NULL,
    page_url text,
    user_agent text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'new'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leaderboard_cache (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pool_id uuid NOT NULL,
    member_id uuid NOT NULL,
    total_points integer DEFAULT 0,
    correct_winners integer DEFAULT 0,
    exact_scores integer DEFAULT 0,
    rank integer DEFAULT 0,
    prev_rank integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matches (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    fixture_id text,
    kickoff_at timestamp with time zone NOT NULL,
    locked_at timestamp with time zone NOT NULL,
    team1_name text NOT NULL,
    team2_name text NOT NULL,
    team1_flag text,
    team2_flag text,
    round text NOT NULL,
    group_name text,
    result_team1 integer,
    result_team2 integer,
    is_final boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    status_short text,
    elapsed_minute integer
);

CREATE TABLE IF NOT EXISTS public.points_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    points integer NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pool_activity (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pool_id uuid NOT NULL,
    member_id uuid NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    subject_type text NOT NULL,
    group_name character(1),
    match_id uuid
);

CREATE TABLE IF NOT EXISTS public.pool_member_name_backup_20260611 (
    member_id uuid,
    user_id uuid,
    old_display_name text,
    new_display_name text,
    backed_up_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pool_members (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pool_id uuid NOT NULL,
    user_id uuid,
    display_name text NOT NULL,
    joined_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pools (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    creator_id uuid NOT NULL,
    name text NOT NULL,
    invite_code text NOT NULL DEFAULT "substring"(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8),
    scoring_style text NOT NULL DEFAULT 'classic'::text,
    payment_status text NOT NULL DEFAULT 'pending'::text,
    stripe_session_id text,
    created_at timestamp with time zone DEFAULT now(),
    event_name text NOT NULL DEFAULT 'FIFA World Cup 2026'::text
);

CREATE TABLE IF NOT EXISTS public.predictions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pool_id uuid NOT NULL,
    member_id uuid NOT NULL,
    match_id uuid NOT NULL,
    pred_team1 integer NOT NULL,
    pred_team2 integer NOT NULL,
    points_awarded integer DEFAULT 0,
    submitted_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    activity_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.third_place_rankings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pool_id uuid,
    user_id uuid,
    rankings jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    points_awarded integer
);

CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    display_name text,
    created_at timestamp with time zone DEFAULT now(),
    points integer NOT NULL DEFAULT 0,
    avatar text DEFAULT 'white_skin_avatar.png'::text
);

-- ============================================================
-- CONSTRAINTS (primary keys, unique, foreign keys, checks)
-- ============================================================

ALTER TABLE public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE public.group_predictions ADD CONSTRAINT group_predictions_pkey PRIMARY KEY (id);
ALTER TABLE public.group_predictions ADD CONSTRAINT group_predictions_pool_id_member_id_group_name_key UNIQUE (pool_id, member_id, group_name);
ALTER TABLE public.group_predictions ADD CONSTRAINT group_predictions_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE public.group_predictions ADD CONSTRAINT group_predictions_member_id_fkey FOREIGN KEY (member_id) REFERENCES pool_members(id) ON DELETE CASCADE;
ALTER TABLE public.group_predictions ADD CONSTRAINT group_predictions_group_name_check CHECK ((group_name ~ '^[A-L]$'::text));
ALTER TABLE public.issue_reports ADD CONSTRAINT issue_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.issue_reports ADD CONSTRAINT issue_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.issue_reports ADD CONSTRAINT issue_reports_message_check CHECK (((char_length(message) >= 1) AND (char_length(message) <= 5000)));
ALTER TABLE public.leaderboard_cache ADD CONSTRAINT leaderboard_cache_pkey PRIMARY KEY (id);
ALTER TABLE public.leaderboard_cache ADD CONSTRAINT leaderboard_cache_pool_id_member_id_key UNIQUE (pool_id, member_id);
ALTER TABLE public.leaderboard_cache ADD CONSTRAINT leaderboard_cache_member_id_fkey FOREIGN KEY (member_id) REFERENCES pool_members(id) ON DELETE CASCADE;
ALTER TABLE public.leaderboard_cache ADD CONSTRAINT leaderboard_cache_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE public.matches ADD CONSTRAINT matches_pkey PRIMARY KEY (id);
ALTER TABLE public.matches ADD CONSTRAINT matches_fixture_id_key UNIQUE (fixture_id);
ALTER TABLE public.points_transactions ADD CONSTRAINT points_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.points_transactions ADD CONSTRAINT points_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.pool_activity ADD CONSTRAINT pool_activity_pkey PRIMARY KEY (id);
ALTER TABLE public.pool_activity ADD CONSTRAINT pool_activity_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE public.pool_activity ADD CONSTRAINT pool_activity_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;
ALTER TABLE public.pool_activity ADD CONSTRAINT pool_activity_member_id_fkey FOREIGN KEY (member_id) REFERENCES pool_members(id) ON DELETE CASCADE;
ALTER TABLE public.pool_activity ADD CONSTRAINT pool_activity_subject_type_check CHECK ((subject_type = ANY (ARRAY['group'::text, 'third_place'::text, 'match'::text])));
ALTER TABLE public.pool_activity ADD CONSTRAINT pool_activity_type_check CHECK ((type = ANY (ARRAY['predictions_created'::text, 'predictions_updated'::text])));
ALTER TABLE public.pool_members ADD CONSTRAINT pool_members_pkey PRIMARY KEY (id);
ALTER TABLE public.pool_members ADD CONSTRAINT pool_members_pool_id_user_id_key UNIQUE (pool_id, user_id);
ALTER TABLE public.pool_members ADD CONSTRAINT pool_members_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE public.pool_members ADD CONSTRAINT pool_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.pools ADD CONSTRAINT pools_pkey PRIMARY KEY (id);
ALTER TABLE public.pools ADD CONSTRAINT pools_invite_code_key UNIQUE (invite_code);
ALTER TABLE public.pools ADD CONSTRAINT pools_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.predictions ADD CONSTRAINT predictions_pkey PRIMARY KEY (id);
ALTER TABLE public.predictions ADD CONSTRAINT predictions_pool_id_member_id_match_id_key UNIQUE (pool_id, member_id, match_id);
ALTER TABLE public.predictions ADD CONSTRAINT predictions_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE public.predictions ADD CONSTRAINT predictions_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;
ALTER TABLE public.predictions ADD CONSTRAINT predictions_member_id_fkey FOREIGN KEY (member_id) REFERENCES pool_members(id) ON DELETE CASCADE;
ALTER TABLE public.reactions ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);
ALTER TABLE public.reactions ADD CONSTRAINT reactions_activity_id_user_id_emoji_key UNIQUE (activity_id, user_id, emoji);
ALTER TABLE public.reactions ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reactions ADD CONSTRAINT reactions_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES pool_activity(id) ON DELETE CASCADE;
ALTER TABLE public.reactions ADD CONSTRAINT reactions_emoji_check CHECK (((char_length(emoji) >= 1) AND (char_length(emoji) <= 16)));
ALTER TABLE public.third_place_rankings ADD CONSTRAINT third_place_rankings_pkey PRIMARY KEY (id);
ALTER TABLE public.third_place_rankings ADD CONSTRAINT third_place_rankings_pool_id_user_id_key UNIQUE (pool_id, user_id);
ALTER TABLE public.third_place_rankings ADD CONSTRAINT third_place_rankings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.third_place_rankings ADD CONSTRAINT third_place_rankings_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX events_pool_idx ON public.events USING btree (pool_id);
CREATE INDEX events_name_time_idx ON public.events USING btree (event_name, created_at DESC);
CREATE INDEX group_predictions_pool_member_idx ON public.group_predictions USING btree (pool_id, member_id);
CREATE INDEX issue_reports_created_at_idx ON public.issue_reports USING btree (created_at DESC);
CREATE INDEX leaderboard_cache_pool_id_rank_idx ON public.leaderboard_cache USING btree (pool_id, rank);
CREATE INDEX matches_kickoff_at_idx ON public.matches USING btree (kickoff_at);
CREATE INDEX matches_is_final_idx ON public.matches USING btree (is_final);
CREATE INDEX pool_activity_match_idx ON public.pool_activity USING btree (match_id);
CREATE INDEX pool_activity_pool_created_idx ON public.pool_activity USING btree (pool_id, created_at DESC);
CREATE INDEX pool_members_user_id_idx ON public.pool_members USING btree (user_id);
CREATE INDEX pool_members_pool_id_idx ON public.pool_members USING btree (pool_id);
CREATE INDEX pools_invite_code_idx ON public.pools USING btree (invite_code);
CREATE INDEX predictions_match_id_idx ON public.predictions USING btree (match_id);
CREATE INDEX predictions_pool_id_member_id_idx ON public.predictions USING btree (pool_id, member_id);
CREATE INDEX reactions_activity_idx ON public.reactions USING btree (activity_id);
