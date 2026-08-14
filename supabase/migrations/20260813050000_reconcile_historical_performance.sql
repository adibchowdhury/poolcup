-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
--
-- Reconciles Historical Performance RPCs from linked prod (pg_get_functiondef).
-- Live ACL (proacl): postgres, authenticated, service_role — no PUBLIC/anon on all four.

-- =============================================================================
-- 1. get_historical_by_season(uuid)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_by_season(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  WITH preds AS (
    SELECT se.id AS event_id, se.name AS event_name, se.sport,
      min(m.kickoff_at) OVER (PARTITION BY se.id) AS season_start,
      COALESCE(pr.points_awarded,0) AS points,
      CASE WHEN pr.pred_team1=m.result_team1 AND pr.pred_team2=m.result_team2 THEN 'exact'
           WHEN sign(pr.pred_team1-pr.pred_team2)=sign(m.result_team1-m.result_team2) THEN 'correct'
           ELSE 'incorrect' END AS outcome
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id AND pm.user_id = p_user_id
    JOIN public.matches m ON m.id = pr.match_id
    JOIN public.sporting_events se ON se.id = m.event_id
    WHERE m.is_final = true AND pr.pred_team1 IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(s ORDER BY (s->>'season_start') DESC), '[]'::jsonb) INTO v FROM (
    SELECT jsonb_build_object(
      'event_id', event_id, 'season', event_name, 'sport', sport,
      'season_start', season_start,
      'finalized', count(*),
      'accuracy', round(count(*) FILTER (WHERE outcome IN ('exact','correct'))::numeric / count(*), 4),
      'exact_count', count(*) FILTER (WHERE outcome='exact'),
      'points', sum(points)
    ) AS s
    FROM preds GROUP BY event_id, event_name, sport, season_start
  ) sub;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_historical_by_season(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_historical_by_season(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_historical_by_season(uuid) TO authenticated, service_role;

-- =============================================================================
-- 2. get_historical_by_year(uuid)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_by_year(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  WITH preds AS (
    SELECT extract(year FROM m.kickoff_at)::int AS yr, COALESCE(pr.points_awarded,0) AS points,
      CASE WHEN pr.pred_team1=m.result_team1 AND pr.pred_team2=m.result_team2 THEN 'exact'
           WHEN sign(pr.pred_team1-pr.pred_team2)=sign(m.result_team1-m.result_team2) THEN 'correct'
           ELSE 'incorrect' END AS outcome
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id AND pm.user_id = p_user_id
    JOIN public.matches m ON m.id = pr.match_id
    WHERE m.is_final = true AND pr.pred_team1 IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(y ORDER BY (y->>'year')::int DESC), '[]'::jsonb) INTO v FROM (
    SELECT jsonb_build_object('year', yr, 'finalized', count(*),
      'accuracy', round(count(*) FILTER (WHERE outcome IN ('exact','correct'))::numeric / count(*), 4),
      'exact_count', count(*) FILTER (WHERE outcome='exact'), 'points', sum(points)) AS y
    FROM preds GROUP BY yr
  ) sub;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_historical_by_year(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_historical_by_year(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_historical_by_year(uuid) TO authenticated, service_role;

-- =============================================================================
-- 3. get_historical_all_time(uuid)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_all_time(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  WITH preds AS (
    SELECT COALESCE(pr.points_awarded,0) AS points,
      CASE WHEN pr.pred_team1=m.result_team1 AND pr.pred_team2=m.result_team2 THEN 'exact'
           WHEN sign(pr.pred_team1-pr.pred_team2)=sign(m.result_team1-m.result_team2) THEN 'correct'
           ELSE 'incorrect' END AS outcome
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id AND pm.user_id = p_user_id
    JOIN public.matches m ON m.id = pr.match_id
    WHERE m.is_final = true AND pr.pred_team1 IS NOT NULL
  )
  SELECT jsonb_build_object(
    'finalized', count(*),
    'accuracy', CASE WHEN count(*)>0 THEN round(count(*) FILTER (WHERE outcome IN ('exact','correct'))::numeric / count(*), 4) ELSE NULL END,
    'exact_count', count(*) FILTER (WHERE outcome='exact'),
    'points', COALESCE(sum(points),0),
    'seasons_played', (SELECT count(DISTINCT m.event_id) FROM public.predictions pr
       JOIN public.pool_members pm ON pm.id=pr.member_id AND pm.user_id=p_user_id
       JOIN public.matches m ON m.id=pr.match_id WHERE m.is_final=true AND pr.pred_team1 IS NOT NULL)
  ) INTO v FROM preds;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_historical_all_time(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_historical_all_time(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_historical_all_time(uuid) TO authenticated, service_role;

-- =============================================================================
-- 4. get_historical_rank_by_season(uuid)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_rank_by_season(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  WITH my_event_pools AS (
    -- pools the user is in, with their event
    SELECT DISTINCT po.id AS pool_id, po.event_id
    FROM public.pool_members pm JOIN public.pools po ON po.id = pm.pool_id
    WHERE pm.user_id = p_user_id AND po.event_id IS NOT NULL
  ),
  pool_points AS (
    SELECT pm.pool_id, pm.user_id, mep.event_id, COALESCE(sum(pr.points_awarded),0) AS pts
    FROM public.pool_members pm
    JOIN my_event_pools mep ON mep.pool_id = pm.pool_id
    LEFT JOIN public.predictions pr ON pr.member_id = pm.id
    GROUP BY pm.pool_id, pm.user_id, mep.event_id
  ),
  ranked AS (
    SELECT pool_id, user_id, event_id, pts,
      rank() OVER (PARTITION BY pool_id ORDER BY pts DESC) AS rnk,
      count(*) OVER (PARTITION BY pool_id) AS pool_size
    FROM pool_points
  ),
  mine AS (
    SELECT event_id, min(rnk) AS best_rank,
      (array_agg(pool_size ORDER BY rnk ASC))[1] AS best_pool_size
    FROM ranked WHERE user_id = p_user_id GROUP BY event_id
  )
  SELECT COALESCE(jsonb_object_agg(event_id, jsonb_build_object('best_rank', best_rank, 'pool_size', best_pool_size)), '{}'::jsonb)
  INTO v FROM mine;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_historical_rank_by_season(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_historical_rank_by_season(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_historical_rank_by_season(uuid) TO authenticated, service_role;
