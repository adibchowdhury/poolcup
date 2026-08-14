-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
--
-- Reconciles match consensus RPCs from linked prod (pg_get_functiondef).
-- Live ACL (proacl) for both target overloads:
--   postgres, authenticated, service_role — no PUBLIC/anon.
-- NOTE (live leftover, NOT included here): get_match_consensus(uuid) 1-arg
-- overload still exists with PUBLIC+anon EXECUTE — separate cleanup if desired.

-- =============================================================================
-- 1. get_match_consensus(uuid, uuid) — global, no counts; API gates Pro/lock
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_match_consensus(p_user_id uuid, p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb; v_total int;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  -- Pro-vs-lock-state access is decided by the API layer. No in-function Pro raise.

  SELECT count(*) INTO v_total FROM public.predictions
  WHERE match_id = p_match_id AND pred_team1 IS NOT NULL;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('has_data', false);
  END IF;

  SELECT jsonb_build_object(
    'has_data', true,
    'updated_at', now(),
    'outcome', (
      SELECT jsonb_build_object(
        'team1_win_pct', round(100.0 * count(*) FILTER (WHERE pred_team1 > pred_team2) / v_total),
        'draw_pct',      round(100.0 * count(*) FILTER (WHERE pred_team1 = pred_team2) / v_total),
        'team2_win_pct', round(100.0 * count(*) FILTER (WHERE pred_team1 < pred_team2) / v_total)
      )
      FROM public.predictions WHERE match_id = p_match_id AND pred_team1 IS NOT NULL
    ),
    'top_scores', (
      SELECT COALESCE(jsonb_agg(s ORDER BY (s->>'pct')::numeric DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('score', pred_team1::text || '-' || pred_team2::text,
          'pct', round(100.0 * count(*) / v_total)) AS s
        FROM public.predictions
        WHERE match_id = p_match_id AND pred_team1 IS NOT NULL
        GROUP BY pred_team1, pred_team2 ORDER BY count(*) DESC LIMIT 3
      ) sub
    )
  ) INTO v;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_match_consensus(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_match_consensus(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_match_consensus(uuid, uuid) TO authenticated, service_role;

-- =============================================================================
-- 2. get_pool_match_consensus(uuid, uuid, uuid) — per-pool, counts + updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_pool_match_consensus(p_user_id uuid, p_pool_id uuid, p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb; v_total int;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_pool_member(p_pool_id, p_user_id) THEN RAISE EXCEPTION 'not_a_member'; END IF;

  SELECT count(*) INTO v_total FROM public.predictions pr
  JOIN public.pool_members pm ON pm.id = pr.member_id
  WHERE pr.match_id = p_match_id AND pr.pool_id = p_pool_id AND pr.pred_team1 IS NOT NULL;

  IF v_total = 0 THEN RETURN jsonb_build_object('has_data', false); END IF;

  SELECT jsonb_build_object(
    'has_data', true,
    'updated_at', now(),
    'total_predictions', v_total,
    'outcome', (
      SELECT jsonb_build_object(
        'team1_win_pct', round(100.0 * count(*) FILTER (WHERE pred_team1 > pred_team2) / v_total),
        'draw_pct',      round(100.0 * count(*) FILTER (WHERE pred_team1 = pred_team2) / v_total),
        'team2_win_pct', round(100.0 * count(*) FILTER (WHERE pred_team1 < pred_team2) / v_total)
      )
      FROM public.predictions WHERE match_id = p_match_id AND pool_id = p_pool_id AND pred_team1 IS NOT NULL
    ),
    'top_scores', (
      SELECT COALESCE(jsonb_agg(s ORDER BY (s->>'pct')::numeric DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('score', pred_team1::text || '-' || pred_team2::text,
          'count', count(*), 'pct', round(100.0 * count(*) / v_total)) AS s
        FROM public.predictions
        WHERE match_id = p_match_id AND pool_id = p_pool_id AND pred_team1 IS NOT NULL
        GROUP BY pred_team1, pred_team2 ORDER BY count(*) DESC LIMIT 5
      ) sub
    )
  ) INTO v;
  RETURN v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_pool_match_consensus(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pool_match_consensus(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pool_match_consensus(uuid, uuid, uuid) TO authenticated, service_role;
