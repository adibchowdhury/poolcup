-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent.
--
-- EXCLUDES (to avoid double-apply):
--   - GRANT/REVOKE statements already in 20260811210000_xp_ledger_grants_and_eval_auth.sql
--   - users.last_seen_xp / users.last_seen_level already in 20260811220000_xp_last_seen_and_eval_revoke.sql
--
-- Objects: 2 columns, 3 tables (+ indexes/RLS/policy), 15 functions, 1 trigger.
-- Function bodies dumped from production via pg_get_functiondef (2026-08-12).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. COLUMNS
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS highest_level integer NOT NULL DEFAULT 1;

ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS rarity text;

-- ---------------------------------------------------------------------------
-- 2. TABLES (+ indexes + RLS)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xp_transactions_unique_award UNIQUE (user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS xp_transactions_user_idx
  ON public.xp_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS xp_transactions_source_idx
  ON public.xp_transactions (source_type, source_id);

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xp_transactions_read_own ON public.xp_transactions;
CREATE POLICY xp_transactions_read_own
  ON public.xp_transactions
  FOR SELECT
  USING (
    (auth.uid() = user_id)
    OR (EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid() AND u.is_admin
    ))
  );

CREATE TABLE IF NOT EXISTS public.match_crowd_pick (
  match_id uuid PRIMARY KEY,
  crowd_pick text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_crowd_pick ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pool_standings_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.pool_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rank integer NOT NULL,
  total_members integer NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pss_user_idx
  ON public.pool_standings_snapshots (user_id, pool_id, snapshot_at);
CREATE INDEX IF NOT EXISTS pss_pool_idx
  ON public.pool_standings_snapshots (pool_id, snapshot_at DESC);

ALTER TABLE public.pool_standings_snapshots ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. FUNCTIONS (production bodies via pg_get_functiondef)
-- ---------------------------------------------------------------------------

-- award_xp
CREATE OR REPLACE FUNCTION public.award_xp(p_user_id uuid, p_amount integer, p_source_type text, p_source_id text, p_description text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_inserted integer;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN RETURN 0; END IF;
  INSERT INTO public.xp_transactions (user_id, amount, source_type, source_id, description)
  VALUES (p_user_id, p_amount, p_source_type, p_source_id, p_description)
  ON CONFLICT (user_id, source_type, source_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN CASE WHEN v_inserted > 0 THEN p_amount ELSE 0 END;
END;
$function$;

-- award_prediction_xp
CREATE OR REPLACE FUNCTION public.award_prediction_xp(p_match_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match record;
  v_pred record;
  v_total_awarded integer := 0;
  v_is_draw_result boolean;
BEGIN
  SELECT m.*, se.sport INTO v_match
  FROM public.matches m LEFT JOIN public.sporting_events se ON se.id = m.event_id
  WHERE m.id = p_match_id;
  IF NOT FOUND OR NOT v_match.is_final THEN RETURN 0; END IF;

  v_is_draw_result := (v_match.result_team1 = v_match.result_team2);

  FOR v_pred IN
    SELECT pr.id, pm.user_id, pr.pred_team1, pr.pred_team2
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id
    WHERE pr.match_id = p_match_id
      AND pr.pred_team1 IS NOT NULL AND pr.pred_team2 IS NOT NULL
  LOOP
    v_total_awarded := v_total_awarded + public.award_xp(
      v_pred.user_id, 5, 'prediction_made', v_pred.id::text, 'Made a prediction');

    IF v_pred.pred_team1 = v_match.result_team1 AND v_pred.pred_team2 = v_match.result_team2 THEN
      v_total_awarded := v_total_awarded + public.award_xp(
        v_pred.user_id, 40, 'prediction_exact', v_pred.id::text, 'Exact score');
    END IF;

    IF v_is_draw_result AND (v_pred.pred_team1 = v_pred.pred_team2)
       AND coalesce(v_match.sport,'soccer') = 'soccer' THEN
      v_total_awarded := v_total_awarded + public.award_xp(
        v_pred.user_id, 20, 'prediction_draw', v_pred.id::text, 'Correct draw');
    ELSIF NOT v_is_draw_result AND (
         (v_match.result_team1 > v_match.result_team2 AND v_pred.pred_team1 > v_pred.pred_team2)
      OR (v_match.result_team2 > v_match.result_team1 AND v_pred.pred_team2 > v_pred.pred_team1)
    ) THEN
      v_total_awarded := v_total_awarded + public.award_xp(
        v_pred.user_id, 15, 'prediction_correct', v_pred.id::text, 'Correct winner');
    END IF;
  END LOOP;

  RETURN v_total_awarded;
END;
$function$;

-- get_user_xp_total
CREATE OR REPLACE FUNCTION public.get_user_xp_total(p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(sum(amount),0)::int FROM public.xp_transactions WHERE user_id = p_user_id;
$function$;

-- level_from_xp
CREATE OR REPLACE FUNCTION public.level_from_xp(p_xp integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT greatest(1, least(50,
    floor((50 + sqrt(50.0*50 + 4*50*greatest(p_xp,0))) / (2*50))::int
  ));
$function$;

-- xp_for_level
CREATE OR REPLACE FUNCTION public.xp_for_level(p_level integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT (50 * (greatest(p_level,1)-1) * (greatest(p_level,1)-1) + 50 * (greatest(p_level,1)-1))::int;
$function$;

-- tg_user_achievement_xp
CREATE OR REPLACE FUNCTION public.tg_user_achievement_xp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.xp_transactions (user_id, amount, source_type, source_id, description)
  SELECT NEW.user_id, a.xp_value, 'achievement', NEW.achievement_id, a.name
  FROM public.achievements a WHERE a.id = NEW.achievement_id
  ON CONFLICT (user_id, source_type, source_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- refresh_match_crowd_picks
CREATE OR REPLACE FUNCTION public.refresh_match_crowd_picks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.match_crowd_pick (match_id, crowd_pick, updated_at)
  SELECT pr.match_id,
    mode() WITHIN GROUP (ORDER BY CASE WHEN pr.pred_team1 > pr.pred_team2 THEN 'h'
                                        WHEN pr.pred_team2 > pr.pred_team1 THEN 'a' ELSE 'd' END),
    now()
  FROM public.predictions pr
  JOIN public.matches m ON m.id = pr.match_id
  WHERE m.is_final
  GROUP BY pr.match_id
  ON CONFLICT (match_id) DO UPDATE SET crowd_pick = EXCLUDED.crowd_pick, updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- capture_standings_snapshots
CREATE OR REPLACE FUNCTION public.capture_standings_snapshots()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.pool_standings_snapshots (pool_id, member_id, user_id, rank, total_members, snapshot_at)
  SELECT lc.pool_id, lc.member_id, pm.user_id, lc.rank,
         (SELECT count(*) FROM public.pool_members x WHERE x.pool_id = lc.pool_id),
         now()
  FROM public.leaderboard_cache lc
  JOIN public.pool_members pm ON pm.id = lc.member_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- admin_award_badge
CREATE OR REPLACE FUNCTION public.admin_award_badge(p_admin_id uuid, p_user_id uuid, p_achievement_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.users WHERE id = p_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE id = p_achievement_id) THEN
    RAISE EXCEPTION 'unknown achievement %', p_achievement_id;
  END IF;
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
  RETURN p_achievement_id;
END;
$function$;

-- admin_revoke_badge
CREATE OR REPLACE FUNCTION public.admin_revoke_badge(p_admin_id uuid, p_user_id uuid, p_achievement_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.users WHERE id = p_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  DELETE FROM public.user_achievements WHERE user_id = p_user_id AND achievement_id = p_achievement_id;
  DELETE FROM public.xp_transactions
    WHERE user_id = p_user_id AND source_type = 'achievement' AND source_id = p_achievement_id;
  RETURN p_achievement_id;
END;
$function$;

-- get_global_xp_leaderboard_page
CREATE OR REPLACE FUNCTION public.get_global_xp_leaderboard_page(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar text, custom_avatar_url text, total_xp integer, global_rank integer, total_ranked integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH user_xp AS (
    SELECT xt.user_id, sum(xt.amount)::int AS xp
    FROM public.xp_transactions xt
    JOIN public.users u ON u.id = xt.user_id
    WHERE NOT coalesce(u.banned, false)
    GROUP BY xt.user_id
  ),
  ranked AS (
    SELECT ux.user_id, ux.xp, rank() OVER (ORDER BY ux.xp DESC, ux.user_id)::int AS global_rank
    FROM user_xp ux WHERE ux.xp > 0
  ),
  cnt AS (SELECT count(*)::int AS total FROM ranked)
  SELECT r.user_id, u.display_name, u.username, u.avatar, u.custom_avatar_url,
         r.xp AS total_xp, r.global_rank, (SELECT total FROM cnt) AS total_ranked
  FROM ranked r JOIN public.users u ON u.id = r.user_id
  ORDER BY r.global_rank
  LIMIT greatest(p_limit,1) OFFSET greatest(p_offset,0);
$function$;

-- get_user_global_rank
CREATE OR REPLACE FUNCTION public.get_user_global_rank(p_user_id uuid)
 RETURNS TABLE(total_xp integer, global_rank integer, total_ranked integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH user_xp AS (
    SELECT xt.user_id, sum(xt.amount)::int AS xp
    FROM public.xp_transactions xt
    JOIN public.users u ON u.id = xt.user_id
    WHERE NOT coalesce(u.banned,false)
    GROUP BY xt.user_id
  ),
  me AS (SELECT COALESCE((SELECT xp FROM user_xp WHERE user_id = p_user_id), 0) AS my_xp)
  SELECT (SELECT my_xp FROM me),
    CASE WHEN (SELECT my_xp FROM me) = 0 THEN NULL
         ELSE (SELECT count(*)::int + 1 FROM user_xp WHERE xp > (SELECT my_xp FROM me)) END,
    (SELECT count(*)::int FROM user_xp WHERE xp > 0);
$function$;

-- get_friends_xp_leaderboard
CREATE OR REPLACE FUNCTION public.get_friends_xp_leaderboard()
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar text, custom_avatar_url text, total_xp integer, friend_rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH my_friends AS (
    SELECT CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS fid
    FROM public.friendships f
    WHERE f.status='accepted' AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    UNION SELECT auth.uid()
  ),
  user_xp AS (
    SELECT xt.user_id, sum(xt.amount)::int AS xp
    FROM public.xp_transactions xt
    JOIN public.users u ON u.id = xt.user_id
    WHERE xt.user_id IN (SELECT fid FROM my_friends) AND NOT coalesce(u.banned,false)
    GROUP BY xt.user_id
  )
  SELECT ux.user_id, u.display_name, u.username, u.avatar, u.custom_avatar_url,
         ux.xp AS total_xp,
         rank() OVER (ORDER BY ux.xp DESC, ux.user_id)::int AS friend_rank
  FROM user_xp ux JOIN public.users u ON u.id = ux.user_id
  ORDER BY friend_rank;
$function$;

-- get_public_profile
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
 RETURNS TABLE(id uuid, display_name text, username text, avatar text, custom_avatar_url text, is_supporter boolean, created_at timestamp with time zone, total_xp integer, badges_earned integer, predictions_made integer, accuracy numeric, favorite_sports text[], friends_count integer, points integer, exact_scores integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    u.id, u.display_name, u.username, u.avatar, u.custom_avatar_url,
    COALESCE(u.is_supporter, false),
    u.created_at,
    -- authoritative XP from the ledger
    COALESCE((SELECT sum(amount)::int FROM public.xp_transactions xt WHERE xt.user_id = u.id), 0),
    COALESCE((SELECT count(*)::int FROM public.user_achievements ua WHERE ua.user_id = u.id), 0),
    COALESCE((SELECT count(*)::int FROM public.predictions pr
              JOIN public.pool_members pm ON pm.id = pr.member_id WHERE pm.user_id = u.id), 0),
    (SELECT CASE WHEN count(*) = 0 THEN NULL
        ELSE round(100.0 * count(*) FILTER (WHERE pr.points_awarded > 0) / count(*)) END
     FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id WHERE pm.user_id = u.id),
    u.favorite_sports,
    COALESCE((SELECT count(*)::int FROM public.friendships f
              WHERE f.status='accepted' AND (f.requester_id = u.id OR f.addressee_id = u.id)), 0),
    COALESCE(u.points, 0),
    COALESCE((SELECT count(*)::int FROM public.predictions pr
              JOIN public.pool_members pm ON pm.id = pr.member_id
              JOIN public.matches m ON m.id = pr.match_id
              WHERE pm.user_id = u.id AND m.is_final = true
                AND pr.pred_team1 = m.result_team1 AND pr.pred_team2 = m.result_team2), 0)
  FROM public.users u
  WHERE u.id = p_user_id AND NOT COALESCE(u.banned, false);
$function$;

-- evaluate_user_achievements
CREATE OR REPLACE FUNCTION public.evaluate_user_achievements(p_user_id uuid)
 RETURNS TABLE(newly_awarded text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m_predictions_made integer := 0; m_correct_predictions integer := 0; m_exact_scores integer := 0;
  m_points_total integer := 0; m_pools_created integer := 0; m_pools_joined integer := 0;
  m_official_pools_joined integer := 0; m_distinct_events integer := 0; m_first_place integer := 0;
  m_top3 integer := 0; m_best_rank integer := NULL; m_max_created_members integer := 0;
  m_official_top3 integer := 0; m_custom_avatar integer := 0; m_account_created integer := 1;
  m_achievements_earned integer := 0; m_streak_days integer := 0; m_consecutive_correct integer := 0;
  m_account_age_days integer := 0; m_perfect_matchdays integer := 0; m_perfect_events integer := 0;
  m_invites_converted integer := 0; m_max_won_pool_members integer := 0;
  m_messages_sent integer := 0; m_reactions_received integer := 0;
  -- NEW metrics
  m_soccer_preds integer := 0; m_basketball_preds integer := 0; m_amfootball_preds integer := 0;
  m_hockey_preds integer := 0; m_baseball_preds integer := 0; m_distinct_sports integer := 0;
  m_correct_draws integer := 0; m_correct_one_goal integer := 0; m_early_preds integer := 0;
  m_first_pred_exact integer := 0; m_predicted_full_event integer := 0; m_late_correct integer := 0;
  m_clutch_exact_late integer := 0; m_clean_sweep integer := 0; m_perfect_week integer := 0;
  m_against_crowd integer := 0; m_photo_finish integer := 0; m_comeback_top3 integer := 0;
BEGIN
  SELECT count(*)::int, count(*) FILTER (WHERE p.points_awarded > 0)::int,
    count(*) FILTER (WHERE p.result_ok AND p.pred_team1 = p.result_team1 AND p.pred_team2 = p.result_team2)::int,
    COALESCE(sum(p.points_awarded),0)::int
  INTO m_predictions_made, m_correct_predictions, m_exact_scores, m_points_total
  FROM (SELECT pr.*, m.result_team1, m.result_team2,
          (m.is_final AND m.result_team1 IS NOT NULL AND m.result_team2 IS NOT NULL) AS result_ok
        FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
        LEFT JOIN public.matches m ON m.id = pr.match_id WHERE pm.user_id = p_user_id) p;

  SELECT m_points_total
    + COALESCE((SELECT sum(gp.points_awarded) FROM public.group_predictions gp
        JOIN public.pool_members pm ON pm.id = gp.member_id WHERE pm.user_id = p_user_id),0)
    + COALESCE((SELECT sum(tpr.points_awarded) FROM public.third_place_rankings tpr
        WHERE tpr.user_id = p_user_id),0)
  INTO m_points_total;

  SELECT count(*)::int INTO m_pools_created FROM public.pools WHERE creator_id = p_user_id;
  SELECT COALESCE(max(mc.cnt),0)::int INTO m_max_created_members
  FROM (SELECT po.id, count(pmx.id) AS cnt FROM public.pools po
        LEFT JOIN public.pool_members pmx ON pmx.pool_id = po.id
        WHERE po.creator_id = p_user_id GROUP BY po.id) mc;

  SELECT count(DISTINCT pm.pool_id)::int, count(DISTINCT pm.pool_id) FILTER (WHERE po.is_official)::int,
         count(DISTINCT po.event_id)::int
  INTO m_pools_joined, m_official_pools_joined, m_distinct_events
  FROM public.pool_members pm JOIN public.pools po ON po.id = pm.pool_id WHERE pm.user_id = p_user_id;

  SELECT count(*) FILTER (WHERE lc.rank = 1)::int, count(*) FILTER (WHERE lc.rank <= 3)::int,
         min(lc.rank)::int, count(*) FILTER (WHERE lc.rank <= 3 AND po.is_official)::int
  INTO m_first_place, m_top3, m_best_rank, m_official_top3
  FROM public.leaderboard_cache lc JOIN public.pool_members pm ON pm.id = lc.member_id
  JOIN public.pools po ON po.id = lc.pool_id WHERE pm.user_id = p_user_id;

  SELECT COALESCE(max(mc.cnt),0)::int INTO m_max_won_pool_members
  FROM public.leaderboard_cache lc
  JOIN public.pool_members pm ON pm.id = lc.member_id
  JOIN (SELECT pool_id, count(*) AS cnt FROM public.pool_members GROUP BY pool_id) mc ON mc.pool_id = lc.pool_id
  WHERE pm.user_id = p_user_id AND lc.rank = 1;

  SELECT count(*)::int INTO m_messages_sent
  FROM public.pool_messages WHERE user_id = p_user_id AND coalesce(message_type,'user') = 'user';

  SELECT count(*)::int INTO m_reactions_received
  FROM public.message_reactions r JOIN public.pool_messages msg ON msg.id = r.message_id
  WHERE msg.user_id = p_user_id AND r.user_id <> p_user_id;

  SELECT CASE WHEN custom_avatar_url IS NOT NULL AND custom_avatar_url <> '' THEN 1 ELSE 0 END,
         COALESCE(EXTRACT(DAY FROM (now() - created_at))::int, 0)
  INTO m_custom_avatar, m_account_age_days FROM public.users WHERE id = p_user_id;

  SELECT count(*)::int INTO m_achievements_earned FROM public.user_achievements WHERE user_id = p_user_id;
  SELECT count(*)::int INTO m_invites_converted FROM public.referrals WHERE referrer_id = p_user_id;

  WITH days AS (SELECT DISTINCT date(pr.submitted_at AT TIME ZONE 'UTC') AS d
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id WHERE pm.user_id = p_user_id),
  grouped AS (SELECT d, d - (row_number() OVER (ORDER BY d))::int AS grp FROM days)
  SELECT COALESCE(max(run_len),0)::int INTO m_streak_days
  FROM (SELECT count(*) AS run_len FROM grouped GROUP BY grp) r;

  WITH per_match AS (SELECT m.id AS match_id, m.kickoff_at, max((pr.points_awarded > 0)::int) AS is_correct
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id WHERE pm.user_id = p_user_id AND m.is_final = true
    GROUP BY m.id, m.kickoff_at),
  seq AS (SELECT match_id, kickoff_at, is_correct, row_number() OVER (ORDER BY kickoff_at, match_id) AS rn FROM per_match),
  grp AS (SELECT *, rn - sum(is_correct) OVER (ORDER BY kickoff_at, match_id ROWS UNBOUNDED PRECEDING) AS island FROM seq)
  SELECT COALESCE(max(run_len),0)::int INTO m_consecutive_correct
  FROM (SELECT count(*) AS run_len FROM grp WHERE is_correct = 1 GROUP BY island) r;

  WITH per_match AS (SELECT date(m.kickoff_at AT TIME ZONE 'UTC') AS d, m.id AS match_id,
      max((pr.points_awarded > 0)::int) AS is_correct
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id WHERE pm.user_id = p_user_id AND m.is_final = true
    GROUP BY date(m.kickoff_at AT TIME ZONE 'UTC'), m.id)
  SELECT count(*)::int INTO m_perfect_matchdays
  FROM (SELECT d FROM per_match GROUP BY d HAVING count(*) >= 2 AND count(*) = sum(is_correct)) fd;

  WITH uem AS (SELECT m.event_id, m.id AS match_id, max((pr.points_awarded > 0)::int) AS is_correct
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id WHERE pm.user_id = p_user_id AND m.is_final = true
    GROUP BY m.event_id, m.id),
  et AS (SELECT event_id, count(*) AS total_final FROM public.matches WHERE is_final = true GROUP BY event_id),
  pue AS (SELECT uem.event_id, count(*) AS predicted, sum(uem.is_correct) AS correct, et.total_final
    FROM uem JOIN et ON et.event_id = uem.event_id GROUP BY uem.event_id, et.total_final)
  SELECT CASE WHEN EXISTS (SELECT 1 FROM pue WHERE predicted >= 0.8 * total_final AND predicted = correct)
    THEN 1 ELSE 0 END INTO m_perfect_events;

  -- ===== NEW METRICS =====
  -- Per-sport prediction counts + distinct sports predicted
  SELECT
    count(*) FILTER (WHERE se.sport='soccer')::int,
    count(*) FILTER (WHERE se.sport='basketball')::int,
    count(*) FILTER (WHERE se.sport='american_football')::int,
    count(*) FILTER (WHERE se.sport='hockey')::int,
    count(*) FILTER (WHERE se.sport='baseball')::int,
    count(DISTINCT se.sport)::int
  INTO m_soccer_preds, m_basketball_preds, m_amfootball_preds, m_hockey_preds, m_baseball_preds, m_distinct_sports
  FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.matches m ON m.id = pr.match_id
  LEFT JOIN public.sporting_events se ON se.id = m.event_id
  WHERE pm.user_id = p_user_id;

  -- Correct draws (soccer, predicted a draw that was a draw and scored)
  SELECT count(*)::int INTO m_correct_draws
  FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.matches m ON m.id = pr.match_id
  WHERE pm.user_id = p_user_id AND m.is_final AND m.result_team1 = m.result_team2
    AND pr.pred_team1 = pr.pred_team2 AND pr.points_awarded > 0;

  -- Correct one-goal games (final decided by exactly 1, predicted the winner correctly)
  SELECT count(*)::int INTO m_correct_one_goal
  FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.matches m ON m.id = pr.match_id
  WHERE pm.user_id = p_user_id AND m.is_final AND abs(m.result_team1 - m.result_team2) = 1
    AND pr.points_awarded > 0;

  -- Early predictions: submitted >= 24h before kickoff
  SELECT count(*)::int INTO m_early_preds
  FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.matches m ON m.id = pr.match_id
  WHERE pm.user_id = p_user_id AND pr.submitted_at <= m.kickoff_at - interval '24 hours';

  -- First prediction was an exact score (earliest submitted prediction scored exact)
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM (
      SELECT pr.pred_team1, pr.pred_team2, m.result_team1, m.result_team2,
             row_number() OVER (ORDER BY pr.submitted_at) AS rn
      FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
      JOIN public.matches m ON m.id = pr.match_id
      WHERE pm.user_id = p_user_id AND m.is_final
    ) f WHERE rn = 1 AND pred_team1 = result_team1 AND pred_team2 = result_team2
  ) THEN 1 ELSE 0 END INTO m_first_pred_exact;

  -- Predicted every match in at least one (final) event
  WITH uev AS (SELECT m.event_id, count(DISTINCT m.id) AS predicted
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id WHERE pm.user_id = p_user_id GROUP BY m.event_id),
  ev AS (SELECT event_id, count(*) AS total FROM public.matches GROUP BY event_id)
  SELECT CASE WHEN EXISTS (SELECT 1 FROM uev JOIN ev ON ev.event_id = uev.event_id
    WHERE uev.predicted = ev.total AND ev.total > 0) THEN 1 ELSE 0 END INTO m_predicted_full_event;

  -- Late correct: submitted within 1h before kickoff AND correct
  SELECT count(*)::int INTO m_late_correct
  FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.matches m ON m.id = pr.match_id
  WHERE pm.user_id = p_user_id AND pr.submitted_at >= m.kickoff_at - interval '1 hour'
    AND pr.submitted_at < m.kickoff_at AND pr.points_awarded > 0;

  -- Clutch: exact score on a match in the last 20% of its event's timeline (near event end)
  WITH ev_span AS (SELECT event_id, min(kickoff_at) AS s, max(kickoff_at) AS e FROM public.matches GROUP BY event_id)
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id JOIN ev_span es ON es.event_id = m.event_id
    WHERE pm.user_id = p_user_id AND m.is_final
      AND pr.pred_team1 = m.result_team1 AND pr.pred_team2 = m.result_team2
      AND es.e > es.s
      AND m.kickoff_at >= es.s + (es.e - es.s) * 0.8
  ) THEN 1 ELSE 0 END INTO m_clutch_exact_late;

  -- Clean sweep: a day where user predicted >=2 matches and got ALL correct (reuse perfect_matchdays >=1)
  SELECT CASE WHEN m_perfect_matchdays >= 1 THEN 1 ELSE 0 END INTO m_clean_sweep;

  -- Perfect week: at least one correct prediction on each of 7 consecutive days
  WITH correct_days AS (
    SELECT DISTINCT date(m.kickoff_at AT TIME ZONE 'UTC') AS d
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id
    WHERE pm.user_id = p_user_id AND m.is_final AND pr.points_awarded > 0),
  grp AS (SELECT d, d - (row_number() OVER (ORDER BY d))::int AS g FROM correct_days)
  SELECT CASE WHEN EXISTS (SELECT 1 FROM grp GROUP BY g HAVING count(*) >= 7) THEN 1 ELSE 0 END INTO m_perfect_week;

  -- Against the crowd wins: user won (points>0) a match where the pool consensus (all predictions)
  -- majority picked the OTHER outcome. Approximation for upset/contrarian badges.
  SELECT count(*)::int INTO m_against_crowd
  FROM public.predictions pr
  JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.matches m ON m.id = pr.match_id
  JOIN public.match_crowd_pick mcp ON mcp.match_id = pr.match_id
  WHERE pm.user_id = p_user_id AND m.is_final AND pr.points_awarded > 0
    AND (CASE WHEN pr.pred_team1 > pr.pred_team2 THEN 'h'
              WHEN pr.pred_team2 > pr.pred_team1 THEN 'a' ELSE 'd' END) <> mcp.crowd_pick;

  -- photo_finish + comeback_top3 handled by separate standings-snapshot metric (default 0 here)
  SELECT count(*)::int INTO m_photo_finish
     FROM public.leaderboard_cache lc1
     JOIN public.pool_members pm ON pm.id = lc1.member_id
     JOIN public.leaderboard_cache lc2 ON lc2.pool_id = lc1.pool_id AND lc2.rank = 2
     WHERE pm.user_id = p_user_id AND lc1.rank = 1 AND (lc1.total_points - lc2.total_points) = 1;
  SELECT CASE WHEN EXISTS (
       SELECT 1
       FROM public.pool_standings_snapshots s
       JOIN public.leaderboard_cache lc ON lc.pool_id = s.pool_id AND lc.member_id = s.member_id
       WHERE s.user_id = p_user_id
         AND s.rank > s.total_members / 2.0   -- was in bottom half at snapshot
         AND lc.rank <= 3                       -- now top 3
     ) THEN 1 ELSE 0 END INTO m_comeback_top3;

  RETURN QUERY
  WITH metric_values(condition_metric, value) AS (VALUES
      ('account_created', m_account_created), ('custom_avatar_set', m_custom_avatar),
      ('predictions_made', m_predictions_made), ('correct_predictions', m_correct_predictions),
      ('exact_scores', m_exact_scores), ('points_total', m_points_total),
      ('pools_created', m_pools_created), ('pools_joined', m_pools_joined),
      ('official_pools_joined', m_official_pools_joined), ('distinct_events_participated', m_distinct_events),
      ('first_place_finishes', m_first_place), ('top3_finishes', m_top3),
      ('best_finish_rank_at_or_below', COALESCE(m_best_rank, 2147483647)),
      ('official_top3_finishes', m_official_top3), ('max_members_in_created_pool', m_max_created_members),
      ('achievements_earned', m_achievements_earned), ('streak_days', m_streak_days),
      ('consecutive_correct', m_consecutive_correct), ('account_age_days', m_account_age_days),
      ('perfect_matchdays', m_perfect_matchdays), ('perfect_events', m_perfect_events),
      ('invites_converted', m_invites_converted), ('max_members_in_won_pool', m_max_won_pool_members),
      ('messages_sent', m_messages_sent), ('reactions_received', m_reactions_received),
      -- NEW
      ('soccer_predictions', m_soccer_preds), ('basketball_predictions', m_basketball_preds),
      ('american_football_predictions', m_amfootball_preds), ('hockey_predictions', m_hockey_preds),
      ('baseball_predictions', m_baseball_preds), ('distinct_sports_predicted', m_distinct_sports),
      ('correct_draws', m_correct_draws), ('correct_one_goal_games', m_correct_one_goal),
      ('early_predictions', m_early_preds), ('first_prediction_exact', m_first_pred_exact),
      ('predicted_full_event', m_predicted_full_event), ('late_correct_predictions', m_late_correct),
      ('clutch_exact_late', m_clutch_exact_late), ('clean_sweep_matchdays', m_clean_sweep),
      ('perfect_week', m_perfect_week), ('against_crowd_wins', m_against_crowd),
      ('photo_finish_wins', m_photo_finish), ('comeback_top3', m_comeback_top3)
  ),
  earned AS (
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT p_user_id, a.id FROM public.achievements a
    JOIN metric_values mv ON mv.condition_metric = a.condition_metric
    WHERE ((a.condition_metric <> 'best_finish_rank_at_or_below' AND mv.value >= a.threshold)
        OR (a.condition_metric = 'best_finish_rank_at_or_below' AND mv.value <= a.threshold))
      AND NOT EXISTS (SELECT 1 FROM public.user_achievements ua
                      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id
  )
  SELECT achievement_id FROM earned;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. TRIGGER
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS user_achievement_xp_ledger ON public.user_achievements;
CREATE TRIGGER user_achievement_xp_ledger
  AFTER INSERT ON public.user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_user_achievement_xp();
