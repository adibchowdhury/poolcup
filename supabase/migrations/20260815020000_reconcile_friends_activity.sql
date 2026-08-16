-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
--
-- Function bodies dumped from production via pg_get_functiondef (2026-08-15).
-- Grants match live EXECUTE privileges (authenticated + service_role; no anon/public).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- get_friends_activity_feed(p_user_id uuid, p_limit integer, p_before timestamptz)
-- Live identity args: p_user_id uuid, p_limit integer, p_before timestamp with time zone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friends_activity_feed(p_user_id uuid, p_limit integer DEFAULT 30, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  WITH friends AS (
    SELECT CASE WHEN requester_id = p_user_id THEN addressee_id ELSE requester_id END AS friend_id
    FROM public.friendships
    WHERE status = 'accepted' AND (requester_id = p_user_id OR addressee_id = p_user_id)
  ),
  badge_events AS (
    SELECT ua.user_id, ua.earned_at AS ts,
      jsonb_build_object(
        'type', 'badge_earned',
        'ts', ua.earned_at,
        'user_id', ua.user_id,
        'username', u.username,
        'avatar', u.avatar,
        'badge_name', a.name,
        'badge_rarity', a.rarity,
        'badge_art', a.art_filename
      ) AS item
    FROM public.user_achievements ua
    JOIN friends f ON f.friend_id = ua.user_id
    JOIN public.users u ON u.id = ua.user_id
    JOIN public.achievements a ON a.id = ua.achievement_id
    WHERE a.is_active = true
      AND (p_before IS NULL OR ua.earned_at < p_before)
  ),
  join_events AS (
    SELECT pm.user_id, pm.joined_at AS ts,
      jsonb_build_object(
        'type', 'pool_joined',
        'ts', pm.joined_at,
        'user_id', pm.user_id,
        'username', u.username,
        'avatar', u.avatar,
        'pool_id', po.id,
        'pool_name', po.name,
        'pool_is_public', po.is_public
      ) AS item
    FROM public.pool_members pm
    JOIN friends f ON f.friend_id = pm.user_id
    JOIN public.users u ON u.id = pm.user_id
    JOIN public.pools po ON po.id = pm.pool_id
    WHERE (p_before IS NULL OR pm.joined_at < p_before)
      AND po.is_public = true  -- only surface joins to public pools (don't leak private-pool membership)
  ),
  combined AS (
    SELECT ts, item FROM badge_events
    UNION ALL
    SELECT ts, item FROM join_events
  )
  SELECT COALESCE(jsonb_agg(item ORDER BY ts DESC), '[]'::jsonb)
  INTO v
  FROM (SELECT ts, item FROM combined ORDER BY ts DESC LIMIT p_limit) sub;

  RETURN v;
END;
$function$

REVOKE EXECUTE ON FUNCTION public.get_friends_activity_feed(uuid, integer, timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_friends_activity_feed(uuid, integer, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_friends_activity_feed(uuid, integer, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends_activity_feed(uuid, integer, timestamp with time zone) TO service_role;
