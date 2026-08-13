-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent where possible.
--
-- Stripe billing + tier-entitlement objects.
-- Function/trigger bodies dumped from production via pg_get_functiondef (2026-08-13).
-- Contents: 5 users billing columns + check + 2 indexes, stripe_webhook_events,
-- 3 billing fns, 3 entitlement fns, 2 guard fns + 2 triggers,
-- 11 commissioner RPCs (10 gated + remove_co_commissioner ungated),
-- 2 announcement RLS policies.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. USERS BILLING COLUMNS (+ check + indexes)
-- ---------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_tier_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_tier_check
      CHECK (tier = ANY (ARRAY['free'::text, 'pro'::text, 'commissioner'::text]));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_stripe_customer_idx
  ON public.users USING btree (stripe_customer_id)
  WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS users_stripe_subscription_idx
  ON public.users USING btree (stripe_subscription_id)
  WHERE (stripe_subscription_id IS NOT NULL);


-- ---------------------------------------------------------------------------
-- 2. STRIPE WEBHOOK EVENTS TABLE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processed',
  error text,
  payload_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS swe_type_idx
  ON public.stripe_webhook_events USING btree (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS swe_status_idx
  ON public.stripe_webhook_events USING btree (status, created_at DESC)
  WHERE (status = 'failed'::text);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: locked to service_role (webhook path) only.


-- ---------------------------------------------------------------------------
-- 3. BILLING FUNCTIONS (verbatim via pg_get_functiondef)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_user_subscription(p_user_id uuid, p_tier text, p_status text, p_stripe_customer_id text, p_stripe_subscription_id text, p_current_period_end timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_tier NOT IN ('free','pro','commissioner') THEN
    RAISE EXCEPTION 'invalid_tier: %', p_tier;
  END IF;

  UPDATE public.users SET
    tier = p_tier,
    subscription_status = p_status,
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    stripe_subscription_id = p_stripe_subscription_id,
    subscription_current_period_end = p_current_period_end
  WHERE id = p_user_id;
END;
$function$

REVOKE ALL ON FUNCTION public.sync_user_subscription(p_user_id uuid, p_tier text, p_status text, p_stripe_customer_id text, p_stripe_subscription_id text, p_current_period_end timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_user_subscription(p_user_id uuid, p_tier text, p_status text, p_stripe_customer_id text, p_stripe_subscription_id text, p_current_period_end timestamp with time zone) FROM anon;
REVOKE ALL ON FUNCTION public.sync_user_subscription(p_user_id uuid, p_tier text, p_status text, p_stripe_customer_id text, p_stripe_subscription_id text, p_current_period_end timestamp with time zone) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_subscription(p_user_id uuid, p_tier text, p_status text, p_stripe_customer_id text, p_stripe_subscription_id text, p_current_period_end timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_stripe_event(p_event_id text, p_event_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_rows integer;
BEGIN
  INSERT INTO public.stripe_webhook_events (stripe_event_id, event_type, status)
  VALUES (p_event_id, p_event_type, 'processing')
  ON CONFLICT (stripe_event_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;   -- true = first time (process it); false = already seen (skip)
END;
$function$

REVOKE ALL ON FUNCTION public.claim_stripe_event(p_event_id text, p_event_type text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_stripe_event(p_event_id text, p_event_type text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_stripe_event(p_event_id text, p_event_type text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(p_event_id text, p_event_type text) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_stripe_event(p_event_id text, p_status text, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.stripe_webhook_events SET status = p_status, error = p_error WHERE stripe_event_id = p_event_id;
$function$

REVOKE ALL ON FUNCTION public.finish_stripe_event(p_event_id text, p_status text, p_error text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_stripe_event(p_event_id text, p_status text, p_error text) FROM anon;
REVOKE ALL ON FUNCTION public.finish_stripe_event(p_event_id text, p_status text, p_error text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finish_stripe_event(p_event_id text, p_status text, p_error text) TO service_role;


-- ---------------------------------------------------------------------------
-- 4. ENTITLEMENT HELPER FUNCTIONS (verbatim)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_has_commissioner(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND tier = 'commissioner');
$function$

REVOKE EXECUTE ON FUNCTION public.user_has_commissioner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_commissioner(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pool_has_commissioner_tools(p_pool_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- the pool's creator (owner) has Commissioner tier
  SELECT EXISTS (
    SELECT 1 FROM public.pools p JOIN public.users u ON u.id = p.creator_id
    WHERE p.id = p_pool_id AND u.tier = 'commissioner'
  );
$function$

REVOKE EXECUTE ON FUNCTION public.pool_has_commissioner_tools(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_has_commissioner_tools(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_use_commissioner_tools(p_pool_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_pool_admin(p_pool_id, p_user_id) AND public.pool_has_commissioner_tools(p_pool_id);
$function$

REVOKE EXECUTE ON FUNCTION public.can_use_commissioner_tools(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_commissioner_tools(uuid,uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 5. GUARD TRIGGER FUNCTIONS + TRIGGERS (verbatim)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_guard_user_protected_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_claims text := nullif(current_setting('request.jwt.claims', true), '');
DECLARE v_role text := coalesce((v_claims::jsonb ->> 'role'), '');
BEGIN
  -- Allow when no client claims (service role / server context) or explicitly service_role.
  IF v_claims IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.banned IS DISTINCT FROM OLD.banned
     OR NEW.points IS DISTINCT FROM OLD.points
     OR NEW.highest_level IS DISTINCT FROM OLD.highest_level
     OR NEW.is_supporter IS DISTINCT FROM OLD.is_supporter
  THEN
    RAISE EXCEPTION 'protected column change not allowed';
  END IF;
  RETURN NEW;
END;
$function$

REVOKE ALL ON FUNCTION public.tg_guard_user_protected_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_guard_user_protected_columns() FROM anon;
REVOKE ALL ON FUNCTION public.tg_guard_user_protected_columns() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tg_guard_user_protected_columns() TO service_role;

DROP TRIGGER IF EXISTS guard_user_protected_columns ON public.users;
CREATE TRIGGER guard_user_protected_columns BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.tg_guard_user_protected_columns();

CREATE OR REPLACE FUNCTION public.tg_guard_commissioner_pool_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_claims text := nullif(current_setting('request.jwt.claims', true), '');
DECLARE v_role text := coalesce((v_claims::jsonb ->> 'role'), '');
BEGIN
  IF v_claims IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.score_exact_points IS DISTINCT FROM OLD.score_exact_points
     OR NEW.score_winner_points IS DISTINCT FROM OLD.score_winner_points
     OR NEW.score_draw_points IS DISTINCT FROM OLD.score_draw_points
     OR NEW.scoring_style IS DISTINCT FROM OLD.scoring_style
     OR NEW.theme_color IS DISTINCT FROM OLD.theme_color
     OR NEW.emblem_url IS DISTINCT FROM OLD.emblem_url
  THEN
    IF NOT public.pool_has_commissioner_tools(NEW.id) THEN
      RAISE EXCEPTION 'commissioner_tier_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$

REVOKE ALL ON FUNCTION public.tg_guard_commissioner_pool_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_guard_commissioner_pool_columns() FROM anon;
REVOKE ALL ON FUNCTION public.tg_guard_commissioner_pool_columns() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tg_guard_commissioner_pool_columns() TO service_role;

DROP TRIGGER IF EXISTS guard_commissioner_pool_columns ON public.pools;
CREATE TRIGGER guard_commissioner_pool_columns BEFORE UPDATE ON public.pools FOR EACH ROW EXECUTE FUNCTION public.tg_guard_commissioner_pool_columns();


-- ---------------------------------------------------------------------------
-- 6. GATED COMMISSIONER RPCs (verbatim — include pool_has_commissioner_tools check)
--    remove_co_commissioner is intentionally NOT tier-gated (included for completeness).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_scoring_version(p_actor_id uuid, p_pool_id uuid, p_style text, p_exact integer, p_winner integer, p_draw integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_next integer;
BEGIN
  IF NOT public.is_pool_admin(p_pool_id, p_actor_id) THEN
    RAISE EXCEPTION 'not_pool_admin';
  END IF;
  IF NOT public.pool_has_commissioner_tools(p_pool_id) THEN
    RAISE EXCEPTION 'commissioner_tier_required';
  END IF;
  SELECT COALESCE(max(version),0) + 1 INTO v_next FROM public.pool_scoring_versions WHERE pool_id = p_pool_id;
  INSERT INTO public.pool_scoring_versions (pool_id, version, scoring_style, exact_points, winner_points, draw_points, changed_by)
  VALUES (p_pool_id, v_next, p_style, p_exact, p_winner, p_draw, p_actor_id);
  RETURN v_next;
END;
$function$

REVOKE ALL ON FUNCTION public.record_scoring_version(p_actor_id uuid, p_pool_id uuid, p_style text, p_exact integer, p_winner integer, p_draw integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_scoring_version(p_actor_id uuid, p_pool_id uuid, p_style text, p_exact integer, p_winner integer, p_draw integer) FROM anon;
REVOKE ALL ON FUNCTION public.record_scoring_version(p_actor_id uuid, p_pool_id uuid, p_style text, p_exact integer, p_winner integer, p_draw integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_scoring_version(p_actor_id uuid, p_pool_id uuid, p_style text, p_exact integer, p_winner integer, p_draw integer) TO service_role;

CREATE OR REPLACE FUNCTION public.recalculate_pool_scoring(p_actor_id uuid, p_pool_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event uuid;
  v_match record;
  v_count integer := 0;
BEGIN
  IF NOT public.is_pool_admin(p_pool_id, p_actor_id) THEN
    RAISE EXCEPTION 'not_pool_admin';
  END IF;
  IF NOT public.pool_has_commissioner_tools(p_pool_id) THEN
    RAISE EXCEPTION 'commissioner_tier_required';
  END IF;

  SELECT event_id INTO v_event FROM public.pools WHERE id = p_pool_id;
  IF v_event IS NULL THEN RETURN 0; END IF;

  -- Re-run scoring for each FINAL match in this pool's event. calculate_match_points is per-match
  -- (rescoring all pools for that match), but idempotent for unchanged pools.
  FOR v_match IN
    SELECT id FROM public.matches WHERE event_id = v_event AND is_final = true
  LOOP
    PERFORM public.calculate_match_points(v_match.id);
    v_count := v_count + 1;
  END LOOP;

  PERFORM public.log_pool_moderation(p_pool_id, p_actor_id, 'scoring_recalculated', NULL,
    jsonb_build_object('matches_rescored', v_count));

  RETURN v_count;
END;
$function$

REVOKE ALL ON FUNCTION public.recalculate_pool_scoring(p_actor_id uuid, p_pool_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_pool_scoring(p_actor_id uuid, p_pool_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recalculate_pool_scoring(p_actor_id uuid, p_pool_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_pool_scoring(p_actor_id uuid, p_pool_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_pool_moderation_log(p_actor_id uuid, p_pool_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, actor_id uuid, actor_name text, action text, target_user_id uuid, target_name text, detail jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_pool_admin(p_pool_id, p_actor_id) THEN
    RAISE EXCEPTION 'not_pool_admin';
  END IF;
  IF NOT public.pool_has_commissioner_tools(p_pool_id) THEN
    RAISE EXCEPTION 'commissioner_tier_required';
  END IF;
  RETURN QUERY
  SELECT l.id, l.actor_id, ua.display_name, l.action, l.target_user_id, ut.display_name, l.detail, l.created_at
  FROM public.pool_moderation_log l
  LEFT JOIN public.users ua ON ua.id = l.actor_id
  LEFT JOIN public.users ut ON ut.id = l.target_user_id
  WHERE l.pool_id = p_pool_id
  ORDER BY l.created_at DESC
  LIMIT greatest(p_limit,1);
END;
$function$

REVOKE ALL ON FUNCTION public.get_pool_moderation_log(p_actor_id uuid, p_pool_id uuid, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pool_moderation_log(p_actor_id uuid, p_pool_id uuid, p_limit integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_pool_moderation_log(p_actor_id uuid, p_pool_id uuid, p_limit integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_pool_moderation_log(p_actor_id uuid, p_pool_id uuid, p_limit integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_members_missing_predictions(p_actor_id uuid, p_pool_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, username text, upcoming_unpredicted integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_pool_admin(p_pool_id, p_actor_id) THEN
    RAISE EXCEPTION 'not_pool_admin';
  END IF;
  IF NOT public.pool_has_commissioner_tools(p_pool_id) THEN
    RAISE EXCEPTION 'commissioner_tier_required';
  END IF;

  RETURN QUERY
  WITH pool_event AS (
    SELECT event_id FROM public.pools WHERE id = p_pool_id
  ),
  upcoming AS (
    SELECT m.id AS match_id
    FROM public.matches m JOIN pool_event pe ON pe.event_id = m.event_id
    WHERE m.kickoff_at > now() AND NOT m.is_final
  ),
  members AS (
    SELECT pm.id AS member_id, pm.user_id FROM public.pool_members pm WHERE pm.pool_id = p_pool_id
  )
  SELECT mem.user_id, u.display_name, u.username,
    (SELECT count(*)::int FROM upcoming up
       WHERE NOT EXISTS (
         SELECT 1 FROM public.predictions pr
         WHERE pr.member_id = mem.member_id AND pr.match_id = up.match_id
           AND pr.pred_team1 IS NOT NULL
       )
    ) AS upcoming_unpredicted
  FROM members mem
  JOIN public.users u ON u.id = mem.user_id
  WHERE (SELECT count(*) FROM upcoming) > 0
  ORDER BY upcoming_unpredicted DESC, u.display_name;
END;
$function$

REVOKE ALL ON FUNCTION public.get_members_missing_predictions(p_actor_id uuid, p_pool_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_members_missing_predictions(p_actor_id uuid, p_pool_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_members_missing_predictions(p_actor_id uuid, p_pool_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_members_missing_predictions(p_actor_id uuid, p_pool_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.export_pool_leaderboard(p_actor_id uuid, p_pool_id uuid)
 RETURNS TABLE(rank integer, display_name text, username text, total_points integer, predictions_made integer, correct_predictions integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_pool_admin(p_pool_id, p_actor_id) THEN RAISE EXCEPTION 'not_pool_admin'; END IF;
  IF NOT public.pool_has_commissioner_tools(p_pool_id) THEN RAISE EXCEPTION 'commissioner_tier_required'; END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT pm.id AS member_id, pm.user_id,
      COALESCE(sum(pr.points_awarded),0)::int AS pts,
      count(pr.id) FILTER (WHERE pr.pred_team1 IS NOT NULL)::int AS made,
      count(pr.id) FILTER (WHERE pr.points_awarded > 0)::int AS correct
    FROM public.pool_members pm
    LEFT JOIN public.predictions pr ON pr.member_id = pm.id AND pr.pool_id = p_pool_id
    WHERE pm.pool_id = p_pool_id
    GROUP BY pm.id, pm.user_id
  )
  SELECT (rank() OVER (ORDER BY a.pts DESC))::int, u.display_name, u.username, a.pts, a.made, a.correct
  FROM agg a JOIN public.users u ON u.id = a.user_id
  ORDER BY a.pts DESC, u.display_name;
END;
$function$

REVOKE ALL ON FUNCTION public.export_pool_leaderboard(p_actor_id uuid, p_pool_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.export_pool_leaderboard(p_actor_id uuid, p_pool_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.export_pool_leaderboard(p_actor_id uuid, p_pool_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.export_pool_leaderboard(p_actor_id uuid, p_pool_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.export_pool_predictions(p_actor_id uuid, p_pool_id uuid)
 RETURNS TABLE(display_name text, username text, match_label text, kickoff_at timestamp with time zone, predicted text, actual_result text, points_awarded integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_pool_admin(p_pool_id, p_actor_id) THEN RAISE EXCEPTION 'not_pool_admin'; END IF;
  IF NOT public.pool_has_commissioner_tools(p_pool_id) THEN RAISE EXCEPTION 'commissioner_tier_required'; END IF;

  RETURN QUERY
  SELECT u.display_name, u.username,
    (m.team1_name || ' v ' || m.team2_name) AS match_label,
    m.kickoff_at,
    (COALESCE(pr.pred_team1::text,'-') || '-' || COALESCE(pr.pred_team2::text,'-')) AS predicted,
    CASE WHEN m.is_final THEN (COALESCE(m.result_team1::text,'-') || '-' || COALESCE(m.result_team2::text,'-')) ELSE 'pending' END AS actual_result,
    COALESCE(pr.points_awarded,0)
  FROM public.predictions pr
  JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.users u ON u.id = pm.user_id
  JOIN public.matches m ON m.id = pr.match_id
  WHERE pr.pool_id = p_pool_id
  ORDER BY u.display_name, m.kickoff_at;
END;
$function$

REVOKE ALL ON FUNCTION public.export_pool_predictions(p_actor_id uuid, p_pool_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.export_pool_predictions(p_actor_id uuid, p_pool_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.export_pool_predictions(p_actor_id uuid, p_pool_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.export_pool_predictions(p_actor_id uuid, p_pool_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_poll(p_actor_id uuid, p_pool_id uuid, p_question text, p_options text[], p_closes_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_poll uuid; i integer;
BEGIN
  IF NOT public.is_pool_admin(p_pool_id, p_actor_id) THEN RAISE EXCEPTION 'not_pool_admin'; END IF;
  IF NOT public.pool_has_commissioner_tools(p_pool_id) THEN RAISE EXCEPTION 'commissioner_tier_required'; END IF;
  IF p_question IS NULL OR length(trim(p_question)) = 0 THEN RAISE EXCEPTION 'empty_question'; END IF;
  IF array_length(p_options,1) IS NULL OR array_length(p_options,1) < 2 THEN RAISE EXCEPTION 'need_at_least_2_options'; END IF;
  IF array_length(p_options,1) > 10 THEN RAISE EXCEPTION 'too_many_options'; END IF;
  INSERT INTO public.polls (pool_id, author_id, question, closes_at)
  VALUES (p_pool_id, p_actor_id, trim(p_question), p_closes_at) RETURNING id INTO v_poll;
  FOR i IN 1..array_length(p_options,1) LOOP
    IF length(trim(p_options[i])) > 0 THEN
      INSERT INTO public.poll_options (poll_id, label, sort_order) VALUES (v_poll, trim(p_options[i]), i);
    END IF;
  END LOOP;
  RETURN v_poll;
END;
$function$

REVOKE ALL ON FUNCTION public.create_poll(p_actor_id uuid, p_pool_id uuid, p_question text, p_options text[], p_closes_at timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_poll(p_actor_id uuid, p_pool_id uuid, p_question text, p_options text[], p_closes_at timestamp with time zone) FROM anon;
REVOKE ALL ON FUNCTION public.create_poll(p_actor_id uuid, p_pool_id uuid, p_question text, p_options text[], p_closes_at timestamp with time zone) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_poll(p_actor_id uuid, p_pool_id uuid, p_question text, p_options text[], p_closes_at timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_poll(p_actor_id uuid, p_poll_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pool uuid;
BEGIN
  SELECT pool_id INTO v_pool FROM public.polls WHERE id = p_poll_id;
  IF v_pool IS NULL THEN RAISE EXCEPTION 'poll_not_found'; END IF;
  IF NOT public.is_pool_admin(v_pool, p_actor_id) THEN RAISE EXCEPTION 'not_pool_admin'; END IF;
  IF NOT public.pool_has_commissioner_tools(v_pool) THEN RAISE EXCEPTION 'commissioner_tier_required'; END IF;
  UPDATE public.polls SET is_active = false WHERE id = p_poll_id;
  PERFORM public.log_pool_moderation(v_pool, p_actor_id, 'poll_deleted', NULL, jsonb_build_object('poll_id', p_poll_id));
END;
$function$

REVOKE ALL ON FUNCTION public.delete_poll(p_actor_id uuid, p_poll_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_poll(p_actor_id uuid, p_poll_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_poll(p_actor_id uuid, p_poll_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_poll(p_actor_id uuid, p_poll_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.add_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_pool_owner(p_pool_id, p_actor_id) THEN RAISE EXCEPTION 'not_pool_owner'; END IF;
  IF NOT public.pool_has_commissioner_tools(p_pool_id) THEN RAISE EXCEPTION 'commissioner_tier_required'; END IF;
  IF public.is_pool_owner(p_pool_id, p_user_id) THEN RAISE EXCEPTION 'owner_is_already_admin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  INSERT INTO public.pool_admins (pool_id, user_id, added_by)
  VALUES (p_pool_id, p_user_id, p_actor_id)
  ON CONFLICT (pool_id, user_id) DO NOTHING;
  PERFORM public.log_pool_moderation(p_pool_id, p_actor_id, 'co_commissioner_added', p_user_id);
  RETURN 'ok';
END;
$function$

REVOKE ALL ON FUNCTION public.add_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.add_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_announcement_pinned(p_actor_id uuid, p_announcement_id uuid, p_pinned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pool uuid;
BEGIN
  SELECT pool_id INTO v_pool FROM public.pool_announcements WHERE id = p_announcement_id;
  IF v_pool IS NULL THEN RAISE EXCEPTION 'announcement_not_found'; END IF;
  IF NOT public.is_pool_admin(v_pool, p_actor_id) THEN RAISE EXCEPTION 'not_pool_admin'; END IF;
  IF NOT public.pool_has_commissioner_tools(v_pool) THEN RAISE EXCEPTION 'commissioner_tier_required'; END IF;
  IF p_pinned THEN
    UPDATE public.pool_announcements SET pinned = false WHERE pool_id = v_pool AND pinned = true;
    UPDATE public.pool_announcements SET pinned = true WHERE id = p_announcement_id;
  ELSE
    UPDATE public.pool_announcements SET pinned = false WHERE id = p_announcement_id;
  END IF;
END;
$function$

REVOKE ALL ON FUNCTION public.set_announcement_pinned(p_actor_id uuid, p_announcement_id uuid, p_pinned boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_announcement_pinned(p_actor_id uuid, p_announcement_id uuid, p_pinned boolean) FROM anon;
REVOKE ALL ON FUNCTION public.set_announcement_pinned(p_actor_id uuid, p_announcement_id uuid, p_pinned boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_announcement_pinned(p_actor_id uuid, p_announcement_id uuid, p_pinned boolean) TO service_role;

-- NOTE: remove_co_commissioner is intentionally ungated (owner may remove co-admins without Commissioner).
CREATE OR REPLACE FUNCTION public.remove_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_pool_owner(p_pool_id, p_actor_id) THEN
    RAISE EXCEPTION 'not_pool_owner';
  END IF;
  DELETE FROM public.pool_admins WHERE pool_id = p_pool_id AND user_id = p_user_id;
  PERFORM public.log_pool_moderation(p_pool_id, p_actor_id, 'co_commissioner_removed', p_user_id);
  RETURN 'ok';
END;
$function$

REVOKE ALL ON FUNCTION public.remove_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.remove_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.remove_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid) TO service_role;


-- ---------------------------------------------------------------------------
-- 7. ANNOUNCEMENT RLS TIER GATE
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS pool_announcements_insert ON public.pool_announcements;
CREATE POLICY pool_announcements_insert
  ON public.pool_announcements
  FOR INSERT
  WITH CHECK ((auth.uid() = author_id) AND is_pool_admin(pool_id, auth.uid()) AND pool_has_commissioner_tools(pool_id));

DROP POLICY IF EXISTS pool_announcements_update ON public.pool_announcements;
CREATE POLICY pool_announcements_update
  ON public.pool_announcements
  FOR UPDATE
  USING (is_pool_admin(pool_id, auth.uid()) AND pool_has_commissioner_tools(pool_id));
