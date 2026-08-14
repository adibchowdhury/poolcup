-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent where possible.
--
-- Reconciles:
--   PART A — pool creation limit (tg_enforce_pool_creation_limit + trigger)
--   PART B — Pro Prediction History (user_has_pro, predictions_member_submitted_idx,
--            get_prediction_history, get_prediction_history_filter_options)
--
-- Function/trigger bodies dumped from linked production via pg_get_functiondef (2026-08-13).
-- Live ACLs (proacl): no anon/PUBLIC EXECUTE on any of these functions.
--   tg_enforce_pool_creation_limit: postgres, service_role
--   user_has_pro / get_prediction_history / get_prediction_history_filter_options:
--     postgres, authenticated, service_role

-- =============================================================================
-- PART A — POOL CREATION LIMIT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tg_enforce_pool_creation_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_role text := coalesce((v_claims::jsonb ->> 'role'), '');
  v_tier text;
  v_owned integer;
  v_limit integer;
BEGIN
  -- Service role / server context bypasses (system/official pools, admin ops).
  IF v_claims IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT tier INTO v_tier FROM public.users WHERE id = NEW.creator_id;

  -- Commissioner = unlimited.
  IF v_tier = 'commissioner' THEN
    RETURN NEW;
  END IF;

  -- free / pro = 3 owned pools.
  v_limit := 3;

  SELECT count(*) INTO v_owned FROM public.pools WHERE creator_id = NEW.creator_id;

  IF v_owned >= v_limit THEN
    RAISE EXCEPTION 'pool_creation_limit_reached';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_pool_creation_limit ON public.pools;
CREATE TRIGGER enforce_pool_creation_limit
  BEFORE INSERT ON public.pools
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_pool_creation_limit();

REVOKE ALL ON FUNCTION public.tg_enforce_pool_creation_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_enforce_pool_creation_limit() FROM anon;
REVOKE ALL ON FUNCTION public.tg_enforce_pool_creation_limit() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tg_enforce_pool_creation_limit() TO service_role;

-- =============================================================================
-- PART B — PRO PREDICTION HISTORY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_has_pro(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND tier IN ('pro','commissioner'));
$function$;

REVOKE EXECUTE ON FUNCTION public.user_has_pro(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_pro(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_has_pro(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS predictions_member_submitted_idx
  ON public.predictions USING btree (member_id, submitted_at DESC);

CREATE OR REPLACE FUNCTION public.get_prediction_history(p_user_id uuid, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_sport text DEFAULT NULL::text, p_event_id uuid DEFAULT NULL::uuid, p_pool_id uuid DEFAULT NULL::uuid, p_result_filter text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_search text DEFAULT NULL::text)
 RETURNS TABLE(prediction_id uuid, match_id uuid, pool_id uuid, pool_name text, sport text, event_name text, round text, team1_name text, team2_name text, kickoff_at timestamp with time zone, predicted text, actual_result text, is_final boolean, points_awarded integer, outcome text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT pr.id AS b_prediction_id, pr.match_id AS b_match_id, pr.pool_id AS b_pool_id, po.name AS b_pool_name,
      se.sport AS b_sport, se.name AS b_event_name, m.round AS b_round,
      m.team1_name AS b_team1_name, m.team2_name AS b_team2_name, m.kickoff_at AS b_kickoff_at,
      (COALESCE(pr.pred_team1::text,'-')||'-'||COALESCE(pr.pred_team2::text,'-')) AS b_predicted,
      CASE WHEN m.is_final THEN (COALESCE(m.result_team1::text,'-')||'-'||COALESCE(m.result_team2::text,'-')) ELSE NULL END AS b_actual_result,
      m.is_final AS b_is_final, COALESCE(pr.points_awarded,0) AS b_points_awarded,
      CASE
        WHEN NOT m.is_final THEN 'pending'
        WHEN pr.pred_team1 = m.result_team1 AND pr.pred_team2 = m.result_team2 THEN 'exact'
        WHEN sign(pr.pred_team1 - pr.pred_team2) = sign(m.result_team1 - m.result_team2) THEN 'correct'
        ELSE 'incorrect'
      END AS b_outcome
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id AND pm.user_id = p_user_id
    JOIN public.pools po ON po.id = pr.pool_id
    JOIN public.matches m ON m.id = pr.match_id
    LEFT JOIN public.sporting_events se ON se.id = m.event_id
    WHERE pr.pred_team1 IS NOT NULL
      AND (p_sport IS NULL OR se.sport = p_sport)
      AND (p_event_id IS NULL OR m.event_id = p_event_id)
      AND (p_pool_id IS NULL OR pr.pool_id = p_pool_id)
      AND (p_date_from IS NULL OR m.kickoff_at >= p_date_from)
      AND (p_date_to IS NULL OR m.kickoff_at <= p_date_to)
      AND (p_search IS NULL OR m.team1_name ILIKE '%'||p_search||'%' OR m.team2_name ILIKE '%'||p_search||'%' OR se.name ILIKE '%'||p_search||'%')
  ),
  filtered AS (
    SELECT * FROM base WHERE (p_result_filter IS NULL OR b_outcome = p_result_filter)
  )
  SELECT f.b_prediction_id, f.b_match_id, f.b_pool_id, f.b_pool_name, f.b_sport, f.b_event_name, f.b_round,
    f.b_team1_name, f.b_team2_name, f.b_kickoff_at, f.b_predicted, f.b_actual_result, f.b_is_final,
    f.b_points_awarded, f.b_outcome,
    (SELECT count(*) FROM filtered) AS total_count
  FROM filtered f
  ORDER BY f.b_kickoff_at DESC NULLS LAST
  LIMIT greatest(p_limit,1) OFFSET greatest(p_offset,0);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_prediction_history(p_user_id uuid, p_limit integer, p_offset integer, p_sport text, p_event_id uuid, p_pool_id uuid, p_result_filter text, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_search text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_prediction_history(p_user_id uuid, p_limit integer, p_offset integer, p_sport text, p_event_id uuid, p_pool_id uuid, p_result_filter text, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_search text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_prediction_history(p_user_id uuid, p_limit integer, p_offset integer, p_sport text, p_event_id uuid, p_pool_id uuid, p_result_filter text, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_search text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_prediction_history_filter_options(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT jsonb_build_object(
    'sports', (
      SELECT COALESCE(jsonb_agg(DISTINCT se.sport ORDER BY se.sport), '[]'::jsonb)
      FROM public.predictions pr
      JOIN public.pool_members pm ON pm.id = pr.member_id AND pm.user_id = p_user_id
      JOIN public.matches m ON m.id = pr.match_id
      JOIN public.sporting_events se ON se.id = m.event_id
      WHERE se.sport IS NOT NULL
    ),
    'events', (
      SELECT COALESCE(jsonb_agg(e ORDER BY (e->>'name')), '[]'::jsonb) FROM (
        SELECT DISTINCT jsonb_build_object('id', se.id, 'name', se.name) AS e
        FROM public.predictions pr
        JOIN public.pool_members pm ON pm.id = pr.member_id AND pm.user_id = p_user_id
        JOIN public.matches m ON m.id = pr.match_id
        JOIN public.sporting_events se ON se.id = m.event_id
        WHERE se.name IS NOT NULL
      ) sub
    ),
    'pools', (
      SELECT COALESCE(jsonb_agg(p ORDER BY (p->>'name')), '[]'::jsonb) FROM (
        SELECT DISTINCT jsonb_build_object('id', po.id, 'name', po.name) AS p
        FROM public.predictions pr
        JOIN public.pool_members pm ON pm.id = pr.member_id AND pm.user_id = p_user_id
        JOIN public.pools po ON po.id = pr.pool_id
      ) sub
    )
  ) INTO v;

  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_prediction_history_filter_options(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_prediction_history_filter_options(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_prediction_history_filter_options(uuid) TO authenticated, service_role;
