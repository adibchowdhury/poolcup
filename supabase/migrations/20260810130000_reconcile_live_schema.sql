-- =====================================================================
-- Reconciliation migration: brings the repo schema record in sync with
-- the LIVE database. Many objects were applied directly via Supabase MCP
-- during development and never written back to the repo. This migration
-- captures the CURRENT LIVE STATE of those objects.
--
-- SAFETY: fully idempotent (IF NOT EXISTS / CREATE OR REPLACE / guarded
-- policy creation). Re-applying on the live DB is a no-op. Its purpose is
-- to make supabase/migrations an accurate record and allow a clean rebuild.
--
-- Does NOT alter behavior of the live DB. Point/scoring logic is captured
-- verbatim from live (config-driven points + deterministic tie-breaks).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COLUMN ADDITIONS (existing tables)
-- ---------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS favorite_sports text[],
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users (lower(username));

ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.pool_messages
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS metadata jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pool_messages_message_type_check') THEN
    ALTER TABLE public.pool_messages
      ADD CONSTRAINT pool_messages_message_type_check CHECK (message_type IN ('user','system'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pool_messages_author_check') THEN
    ALTER TABLE public.pool_messages
      ADD CONSTRAINT pool_messages_author_check CHECK (
        (message_type = 'user'   AND user_id IS NOT NULL) OR
        (message_type = 'system' AND user_id IS NULL)
      );
  END IF;
END $$;

ALTER TABLE public.leaderboard_cache
  ADD COLUMN IF NOT EXISTS climb_streak integer NOT NULL DEFAULT 0;

ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS art_filename text,
  ADD COLUMN IF NOT EXISTS list_order integer;

-- ---------------------------------------------------------------------
-- 2. NEW TABLES
-- ---------------------------------------------------------------------

-- Pre-launch waitlist
CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  ref        text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique ON public.waitlist (lower(email));
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Teams catalog + rosters
CREATE TABLE IF NOT EXISTS public.teams (
  api_id     integer PRIMARY KEY,
  name       text,
  logo       text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.team_players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_api_id integer NOT NULL REFERENCES public.teams(api_id) ON DELETE CASCADE,
  api_id      integer,
  name        text NOT NULL,
  photo       text,
  number      integer,
  position    text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_api_id, api_id)
);
CREATE INDEX IF NOT EXISTS team_players_team_idx ON public.team_players(team_api_id);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. RLS POLICIES (guarded creation)
-- ---------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='teams' AND policyname='teams_read') THEN
    CREATE POLICY teams_read ON public.teams FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_players' AND policyname='team_players_read') THEN
    CREATE POLICY team_players_read ON public.team_players FOR SELECT USING (true);
  END IF;
  -- Pool leave: non-creator self-delete
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_members' AND policyname='members_delete') THEN
    CREATE POLICY members_delete ON public.pool_members
      FOR DELETE USING (
        auth.uid() = user_id
        AND NOT EXISTS (SELECT 1 FROM public.pools p WHERE p.id = pool_members.pool_id AND p.creator_id = auth.uid())
      );
  END IF;
END $$;

-- NOTE: waitlist has intentionally NO select policy (emails private; writes via RPC/service role).

-- ---------------------------------------------------------------------
-- 4. FUNCTIONS / RPCS (current live definitions)
-- NOTE: The large scoring functions (calculate_match_points,
-- rebuild_all_winner_leaderboards, void_match_points) and the
-- achievements evaluator (evaluate_user_achievements) are captured in
-- their dedicated migrations already applied this cycle. This file
-- documents the remaining helper RPCs. The scoring functions' current
-- definitions live in:
--   - 20260810_deterministic_leaderboard_tiebreak
--   - 20260810_winner_leaderboard_stable_tiebreak
--   - 20260810_void_match_points_clawback
--   - 20260806_add_won_pool_size_metric / add_social_metrics_2b (evaluator)
-- ---------------------------------------------------------------------

-- Waitlist join
CREATE OR REPLACE FUNCTION public.join_waitlist(p_email text, p_ref text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_email text := lower(trim(p_email));
BEGIN
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  INSERT INTO public.waitlist (email, ref) VALUES (v_email, p_ref)
  ON CONFLICT (lower(email)) DO NOTHING;
  RETURN 'ok';
END; $fn$;
GRANT EXECUTE ON FUNCTION public.join_waitlist(text, text) TO anon, authenticated, service_role;

-- Username validation + availability
CREATE OR REPLACE FUNCTION public.is_valid_username(p_username text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
  SELECT p_username IS NOT NULL
     AND length(p_username) BETWEEN 2 AND 32
     AND p_username = lower(p_username)
     AND p_username ~ '^[a-z0-9_.]+$'
     AND p_username !~ '\.\.';
$fn$;

CREATE OR REPLACE FUNCTION public.check_username_available(p_username text, p_exclude_user uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_taken boolean;
BEGIN
  IF NOT public.is_valid_username(lower(trim(p_username))) THEN
    RETURN jsonb_build_object('available', false, 'reason', 'invalid_format');
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE lower(username) = lower(trim(p_username))
      AND (p_exclude_user IS NULL OR id <> p_exclude_user)
  ) INTO v_taken;
  RETURN jsonb_build_object('available', NOT v_taken, 'reason', CASE WHEN v_taken THEN 'taken' ELSE 'ok' END);
END; $fn$;
GRANT EXECUTE ON FUNCTION public.is_valid_username(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_username_available(text, uuid) TO authenticated, service_role;

-- Pool ownership transfer + leave
CREATE OR REPLACE FUNCTION public.transfer_pool_ownership(p_pool_id uuid, p_new_owner_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_is_creator boolean; v_new_is_member boolean;
BEGIN
  SELECT (creator_id = auth.uid()) INTO v_is_creator FROM public.pools WHERE id = p_pool_id;
  IF NOT coalesce(v_is_creator, false) THEN RAISE EXCEPTION 'not_pool_creator'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = p_new_owner_user_id)
  INTO v_new_is_member;
  IF NOT v_new_is_member THEN RAISE EXCEPTION 'new_owner_not_member'; END IF;
  IF p_new_owner_user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_transfer_to_self'; END IF;
  UPDATE public.pools SET creator_id = p_new_owner_user_id WHERE id = p_pool_id;
END; $fn$;

CREATE OR REPLACE FUNCTION public.leave_pool(p_pool_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_is_creator boolean; v_other_members int;
BEGIN
  SELECT (creator_id = auth.uid()) INTO v_is_creator FROM public.pools WHERE id = p_pool_id;
  IF v_is_creator IS NULL THEN RAISE EXCEPTION 'pool_not_found'; END IF;
  IF v_is_creator THEN
    SELECT count(*) INTO v_other_members FROM public.pool_members
    WHERE pool_id = p_pool_id AND user_id <> auth.uid();
    IF v_other_members = 0 THEN RAISE EXCEPTION 'creator_only_member';
    ELSE RAISE EXCEPTION 'creator_must_transfer'; END IF;
  END IF;
  DELETE FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = auth.uid();
  RETURN 'left';
END; $fn$;
GRANT EXECUTE ON FUNCTION public.transfer_pool_ownership(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_pool(uuid) TO authenticated, service_role;

-- Match hub read RPCs
CREATE OR REPLACE FUNCTION public.get_match_consensus(p_match_id uuid)
RETURNS TABLE(home_pct numeric, draw_pct numeric, away_pct numeric, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  WITH picks AS (
    SELECT CASE WHEN pred_team1 > pred_team2 THEN 'home'
                WHEN pred_team2 > pred_team1 THEN 'away' ELSE 'draw' END AS outcome
    FROM public.predictions
    WHERE match_id = p_match_id AND pred_team1 IS NOT NULL AND pred_team2 IS NOT NULL
  ), agg AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE outcome='home') AS home,
      count(*) FILTER (WHERE outcome='draw') AS draw,
      count(*) FILTER (WHERE outcome='away') AS away
    FROM picks
  )
  SELECT CASE WHEN total>0 THEN round(home*100.0/total,0) ELSE 0 END,
         CASE WHEN total>0 THEN round(draw*100.0/total,0) ELSE 0 END,
         CASE WHEN total>0 THEN round(away*100.0/total,0) ELSE 0 END,
         total::int FROM agg;
$fn$;

CREATE OR REPLACE FUNCTION public.get_match_common_scores(p_match_id uuid, p_limit integer DEFAULT 3)
RETURNS TABLE(score text, cnt integer, pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  WITH s AS (
    SELECT pred_team1||'-'||pred_team2 AS score FROM public.predictions
    WHERE match_id = p_match_id AND pred_team1 IS NOT NULL AND pred_team2 IS NOT NULL
  ), t AS (SELECT count(*) AS total FROM s)
  SELECT s.score, count(*)::int,
         round(count(*)*100.0/NULLIF((SELECT total FROM t),0),0)
  FROM s GROUP BY s.score ORDER BY count(*) DESC LIMIT greatest(p_limit,1);
$fn$;

CREATE OR REPLACE FUNCTION public.get_friends_match_predictions(p_match_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar text, custom_avatar_url text, pred_team1 int, pred_team2 int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  WITH my_friends AS (
    SELECT CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS fid
    FROM public.friendships f
    WHERE f.status='accepted' AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
  )
  SELECT DISTINCT u.id, u.display_name, u.avatar, u.custom_avatar_url, pr.pred_team1, pr.pred_team2
  FROM public.predictions pr
  JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.users u ON u.id = pm.user_id
  WHERE pr.match_id = p_match_id AND pm.user_id IN (SELECT fid FROM my_friends);
$fn$;

CREATE OR REPLACE FUNCTION public.get_team_form(p_team_name text, p_limit integer DEFAULT 5)
RETURNS TABLE(kickoff_at timestamptz, opponent text, gf int, ga int, result char)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT m.kickoff_at,
    CASE WHEN m.team1_name = p_team_name THEN m.team2_name ELSE m.team1_name END,
    CASE WHEN m.team1_name = p_team_name THEN m.result_team1 ELSE m.result_team2 END,
    CASE WHEN m.team1_name = p_team_name THEN m.result_team2 ELSE m.result_team1 END,
    CASE
      WHEN (CASE WHEN m.team1_name = p_team_name THEN m.result_team1 ELSE m.result_team2 END)
         > (CASE WHEN m.team1_name = p_team_name THEN m.result_team2 ELSE m.result_team1 END) THEN 'W'
      WHEN (CASE WHEN m.team1_name = p_team_name THEN m.result_team1 ELSE m.result_team2 END)
         < (CASE WHEN m.team1_name = p_team_name THEN m.result_team2 ELSE m.result_team1 END) THEN 'L'
      ELSE 'D' END::char
  FROM public.matches m
  WHERE (m.team1_name = p_team_name OR m.team2_name = p_team_name)
    AND m.is_final = true AND m.result_team1 IS NOT NULL
  ORDER BY m.kickoff_at DESC LIMIT greatest(p_limit,1);
$fn$;

CREATE OR REPLACE FUNCTION public.get_head_to_head(p_team1 text, p_team2 text, p_limit integer DEFAULT 5)
RETURNS TABLE(kickoff_at timestamptz, team1_name text, team2_name text, result_team1 int, result_team2 int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT m.kickoff_at, m.team1_name, m.team2_name, m.result_team1, m.result_team2
  FROM public.matches m
  WHERE m.is_final = true AND m.result_team1 IS NOT NULL
    AND ((m.team1_name = p_team1 AND m.team2_name = p_team2)
      OR (m.team1_name = p_team2 AND m.team2_name = p_team1))
  ORDER BY m.kickoff_at DESC LIMIT greatest(p_limit,1);
$fn$;

GRANT EXECUTE ON FUNCTION public.get_match_consensus(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_match_common_scores(uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_friends_match_predictions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_team_form(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_head_to_head(text, text, integer) TO anon, authenticated, service_role;

-- Match-moments (system chat messages)
CREATE OR REPLACE FUNCTION public.post_match_moments(p_match_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_match record; v_pool record; v_msgs int := 0;
  v_team1 text; v_team2 text; v_exact_names text; v_leader_name text;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND OR NOT coalesce(v_match.is_final,false)
     OR v_match.result_team1 IS NULL OR v_match.result_team2 IS NULL THEN RETURN 0; END IF;
  v_team1 := coalesce(v_match.team1_name,'Team 1');
  v_team2 := coalesce(v_match.team2_name,'Team 2');
  FOR v_pool IN SELECT DISTINCT p.pool_id FROM public.predictions p WHERE p.match_id = p_match_id LOOP
    IF EXISTS (SELECT 1 FROM public.pool_messages m
      WHERE m.pool_id = v_pool.pool_id AND m.message_type='system'
        AND m.metadata->>'match_id' = p_match_id::text AND m.metadata->>'kind'='full_time') THEN CONTINUE; END IF;
    INSERT INTO public.pool_messages (pool_id, user_id, content, message_type, metadata)
    VALUES (v_pool.pool_id, NULL,
      format('%s %s-%s %s', v_team1, v_match.result_team1, v_match.result_team2, v_team2), 'system',
      jsonb_build_object('kind','full_time','match_id',p_match_id::text,'team1',v_team1,'team2',v_team2,
        'score1',v_match.result_team1,'score2',v_match.result_team2,
        'team1_logo',v_match.team1_logo,'team2_logo',v_match.team2_logo));
    v_msgs := v_msgs + 1;
    SELECT string_agg(pm.display_name, ', ') INTO v_exact_names
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    WHERE pr.match_id = p_match_id AND pr.pool_id = v_pool.pool_id
      AND pr.pred_team1 = v_match.result_team1 AND pr.pred_team2 = v_match.result_team2;
    IF v_exact_names IS NOT NULL THEN
      INSERT INTO public.pool_messages (pool_id, user_id, content, message_type, metadata)
      VALUES (v_pool.pool_id, NULL,
        format('🎯 Exact score! %s nailed %s-%s', v_exact_names, v_match.result_team1, v_match.result_team2),
        'system', jsonb_build_object('kind','exact_score','match_id',p_match_id::text,'players',v_exact_names));
      v_msgs := v_msgs + 1;
    END IF;
    SELECT pm.display_name INTO v_leader_name
    FROM public.leaderboard_cache lc JOIN public.pool_members pm ON pm.id = lc.member_id
    WHERE lc.pool_id = v_pool.pool_id AND lc.rank = 1 ORDER BY lc.total_points DESC LIMIT 1;
    IF v_leader_name IS NOT NULL THEN
      INSERT INTO public.pool_messages (pool_id, user_id, content, message_type, metadata)
      VALUES (v_pool.pool_id, NULL, format('👑 %s is now leading the pool!', v_leader_name),
        'system', jsonb_build_object('kind','new_leader','match_id',p_match_id::text,'player',v_leader_name));
      v_msgs := v_msgs + 1;
    END IF;
  END LOOP;
  RETURN v_msgs;
END; $fn$;
GRANT EXECUTE ON FUNCTION public.post_match_moments(uuid) TO service_role;

-- Platform stats (anon landing)
-- (documented as-is; definition already applied live)

-- =====================================================================
-- END reconciliation. Scoring/evaluator function bodies are captured in
-- their own dedicated migrations applied the same cycle (see note above).
-- =====================================================================
