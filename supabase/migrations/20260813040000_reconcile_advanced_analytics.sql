-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
--
-- Reconciles Advanced Analytics RPCs as of live linked prod dump (pg_get_functiondef).
-- Includes the season-aware 4-param get_user_analytics / get_user_analytics_timeseries.
--
-- LIVE ACL (current): all five functions — authenticated + service_role only
-- (PUBLIC/anon EXECUTE revoked on the 4-param analytics/timeseries overloads).
-- Orphaned 3-param overloads were dropped on prod; DROP IF EXISTS kept here for rebuild parity.

-- =============================================================================
-- 1. current_season_event_ids()
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_season_event_ids()
 RETURNS TABLE(event_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH event_windows AS (
    SELECT se.id AS event_id, se.sport,
      min(m.kickoff_at) AS season_start, max(m.kickoff_at) AS season_end
    FROM public.sporting_events se
    JOIN public.matches m ON m.event_id = se.id
    GROUP BY se.id, se.sport
  )
  SELECT event_id FROM event_windows
  WHERE season_end >= now() - interval '30 days'      -- not ended long ago
    AND season_start <= now() + interval '30 days'    -- already started or starting very soon
;
$function$;

REVOKE EXECUTE ON FUNCTION public.current_season_event_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_season_event_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_season_event_ids() TO authenticated, service_role;

-- =============================================================================
-- 2. get_user_analytics(..., p_season_only) — 4-param
-- =============================================================================

-- Superseded by 4-param p_season_only overload; dropped on prod after MCP apply.
DROP FUNCTION IF EXISTS public.get_user_analytics(uuid, timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_user_analytics(p_user_id uuid, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_season_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  WITH preds AS (
    SELECT pr.id, pr.points_awarded, m.kickoff_at, se.sport, se.id AS event_id, se.name AS event_name,
      CASE
        WHEN pr.pred_team1 = m.result_team1 AND pr.pred_team2 = m.result_team2 THEN 'exact'
        WHEN sign(pr.pred_team1 - pr.pred_team2) = sign(m.result_team1 - m.result_team2) THEN 'correct'
        ELSE 'incorrect'
      END AS outcome
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id AND pm.user_id = p_user_id
    JOIN public.matches m ON m.id = pr.match_id
    LEFT JOIN public.sporting_events se ON se.id = m.event_id
    WHERE m.is_final = true AND pr.pred_team1 IS NOT NULL
      AND (p_date_from IS NULL OR m.kickoff_at >= p_date_from)
      AND (p_date_to IS NULL OR m.kickoff_at <= p_date_to)
      AND (NOT p_season_only OR m.event_id IN (SELECT event_id FROM public.current_season_event_ids()))
  ),
  totals AS (
    SELECT count(*) AS finalized,
      count(*) FILTER (WHERE outcome='exact') AS exact_c,
      count(*) FILTER (WHERE outcome IN ('exact','correct')) AS correct_c,
      COALESCE(sum(points_awarded),0) AS points
    FROM preds
  )
  SELECT jsonb_build_object(
    'finalized_predictions', t.finalized, 'exact_count', t.exact_c, 'correct_count', t.correct_c, 'total_points', t.points,
    'accuracy', CASE WHEN t.finalized > 0 THEN round(t.correct_c::numeric / t.finalized, 4) ELSE NULL END,
    'exact_rate', CASE WHEN t.finalized > 0 THEN round(t.exact_c::numeric / t.finalized, 4) ELSE NULL END,
    'by_sport', (SELECT COALESCE(jsonb_agg(s ORDER BY (s->>'sport')), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('sport', sport, 'finalized', count(*),
        'accuracy', round(count(*) FILTER (WHERE outcome IN ('exact','correct'))::numeric / count(*), 4),
        'exact_rate', round(count(*) FILTER (WHERE outcome='exact')::numeric / count(*), 4),
        'points', sum(points_awarded)) AS s
      FROM preds WHERE sport IS NOT NULL GROUP BY sport) sub),
    'by_competition', (SELECT COALESCE(jsonb_agg(c ORDER BY (c->>'event_name')), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('event_id', event_id, 'event_name', event_name, 'finalized', count(*),
        'accuracy', round(count(*) FILTER (WHERE outcome IN ('exact','correct'))::numeric / count(*), 4),
        'exact_rate', round(count(*) FILTER (WHERE outcome='exact')::numeric / count(*), 4),
        'points', sum(points_awarded)) AS c
      FROM preds WHERE event_id IS NOT NULL GROUP BY event_id, event_name) sub),
    'best_sport', (SELECT sport FROM preds WHERE sport IS NOT NULL GROUP BY sport HAVING count(*) >= 10
      ORDER BY count(*) FILTER (WHERE outcome IN ('exact','correct'))::numeric / count(*) DESC, count(*) DESC LIMIT 1),
    'weakest_sport', (SELECT sport FROM preds WHERE sport IS NOT NULL GROUP BY sport HAVING count(*) >= 10
      ORDER BY count(*) FILTER (WHERE outcome IN ('exact','correct'))::numeric / count(*) ASC, count(*) DESC LIMIT 1)
  ) INTO v FROM totals t;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_analytics(p_user_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_season_only boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_analytics(p_user_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_season_only boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_analytics(p_user_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_season_only boolean) TO authenticated, service_role;

-- =============================================================================
-- 3. get_user_analytics_comparisons(uuid)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_analytics_comparisons(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb; v_poolcup_avg numeric; v_friends_avg numeric;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  WITH per_user AS (
    SELECT pm.user_id,
      count(*) AS finalized,
      count(*) FILTER (WHERE (pr.pred_team1=m.result_team1 AND pr.pred_team2=m.result_team2)
                          OR sign(pr.pred_team1-pr.pred_team2)=sign(m.result_team1-m.result_team2)) AS correct_c
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id
    WHERE m.is_final = true AND pr.pred_team1 IS NOT NULL
    GROUP BY pm.user_id
    HAVING count(*) >= 10
  )
  SELECT round(avg(correct_c::numeric / finalized), 4) INTO v_poolcup_avg FROM per_user;

  WITH per_user AS (
    SELECT pm.user_id,
      count(*) AS finalized,
      count(*) FILTER (WHERE (pr.pred_team1=m.result_team1 AND pr.pred_team2=m.result_team2)
                          OR sign(pr.pred_team1-pr.pred_team2)=sign(m.result_team1-m.result_team2)) AS correct_c
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id
    WHERE m.is_final = true AND pr.pred_team1 IS NOT NULL
    GROUP BY pm.user_id
    HAVING count(*) >= 10
  ),
  my_friends AS (
    SELECT CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END AS friend_id
    FROM public.friendships f
    WHERE (f.requester_id = p_user_id OR f.addressee_id = p_user_id) AND f.status = 'accepted'
  )
  SELECT round(avg(pu.correct_c::numeric / pu.finalized), 4) INTO v_friends_avg
  FROM per_user pu WHERE pu.user_id IN (SELECT friend_id FROM my_friends);

  SELECT jsonb_build_object(
    'poolcup_avg_accuracy', v_poolcup_avg,
    'friends_avg_accuracy', v_friends_avg
  ) INTO v;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_analytics_comparisons(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_analytics_comparisons(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_analytics_comparisons(uuid) TO authenticated, service_role;

-- =============================================================================
-- 4. get_user_analytics_timeseries(..., p_season_only) — 4-param
-- =============================================================================

-- Superseded by 4-param p_season_only overload; dropped on prod after MCP apply.
DROP FUNCTION IF EXISTS public.get_user_analytics_timeseries(uuid, timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_user_analytics_timeseries(p_user_id uuid, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_season_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  WITH preds AS (
    SELECT m.kickoff_at, COALESCE(pr.points_awarded,0) AS points,
      CASE WHEN (pr.pred_team1=m.result_team1 AND pr.pred_team2=m.result_team2)
                OR sign(pr.pred_team1-pr.pred_team2)=sign(m.result_team1-m.result_team2)
           THEN 1 ELSE 0 END AS is_correct,
      row_number() OVER (ORDER BY m.kickoff_at) AS seq
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id AND pm.user_id = p_user_id
    JOIN public.matches m ON m.id = pr.match_id
    WHERE m.is_final = true AND pr.pred_team1 IS NOT NULL
      AND (p_date_from IS NULL OR m.kickoff_at >= p_date_from)
      AND (p_date_to IS NULL OR m.kickoff_at <= p_date_to)
      AND (NOT p_season_only OR m.event_id IN (SELECT event_id FROM public.current_season_event_ids()))
  )
  SELECT jsonb_build_object(
    'daily', (SELECT COALESCE(jsonb_agg(d ORDER BY (d->>'day')), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('day', to_char(date_trunc('day', kickoff_at), 'YYYY-MM-DD'),
        'accuracy', round(avg(is_correct)::numeric, 4), 'points', sum(points), 'predictions', count(*)) AS d
      FROM preds GROUP BY date_trunc('day', kickoff_at)) sub),
    'recent_form', (SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'seq')::int), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('seq', seq,
        'rolling_accuracy', round(avg(is_correct) OVER (ORDER BY seq ROWS BETWEEN 9 PRECEDING AND CURRENT ROW), 4)) AS r
      FROM preds) sub)
  ) INTO v;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_analytics_timeseries(p_user_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_season_only boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_analytics_timeseries(p_user_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_season_only boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_analytics_timeseries(p_user_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_season_only boolean) TO authenticated, service_role;

-- =============================================================================
-- 5. get_user_best_rank(uuid)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_best_rank(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  WITH pool_points AS (
    -- total points per member per pool
    SELECT pm.pool_id, pm.user_id, COALESCE(sum(pr.points_awarded),0) AS pts
    FROM public.pool_members pm
    LEFT JOIN public.predictions pr ON pr.member_id = pm.id
    WHERE pm.pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = p_user_id)
    GROUP BY pm.pool_id, pm.user_id
  ),
  ranked AS (
    SELECT pool_id, user_id, pts,
      rank() OVER (PARTITION BY pool_id ORDER BY pts DESC) AS rnk,
      count(*) OVER (PARTITION BY pool_id) AS pool_size
    FROM pool_points
  ),
  mine AS (
    SELECT r.pool_id, r.rnk, r.pool_size, po.name AS pool_name
    FROM ranked r JOIN public.pools po ON po.id = r.pool_id
    WHERE r.user_id = p_user_id
  )
  SELECT jsonb_build_object(
    'best_rank', (SELECT rnk FROM mine ORDER BY rnk ASC LIMIT 1),
    'best_rank_pool', (SELECT pool_name FROM mine ORDER BY rnk ASC LIMIT 1),
    'best_rank_pool_size', (SELECT pool_size FROM mine ORDER BY rnk ASC LIMIT 1),
    'pools_count', (SELECT count(*) FROM mine)
  ) INTO v;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_best_rank(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_best_rank(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_best_rank(uuid) TO authenticated, service_role;
