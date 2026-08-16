-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
--
-- Function bodies dumped from production via pg_get_functiondef (2026-08-15).
-- Grants match live EXECUTE privileges (authenticated + service_role; no anon/public).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- get_discover_sections(p_user_id uuid, p_cap integer)
-- Live identity args: p_user_id uuid, p_cap integer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_discover_sections(p_user_id uuid, p_cap integer DEFAULT 4)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  WITH base AS (
    SELECT p.id, p.name, p.avatar, p.emblem_url, p.theme_color, p.is_official, p.is_public,
           p.event_id, se.sport, se.name AS event_name,
           (SELECT count(*) FROM public.pool_members pm WHERE pm.pool_id = p.id) AS member_count,
           (SELECT count(*) FROM public.pool_members pm WHERE pm.pool_id = p.id
              AND pm.joined_at >= now() - interval '7 days') AS recent_joins
    FROM public.pools p
    LEFT JOIN public.sporting_events se ON se.id = p.event_id
    WHERE p.accepting_members = true
      AND (p.is_public = true OR p.is_official = true)
  ),
  official AS (
    SELECT * FROM base WHERE is_official = true ORDER BY member_count DESC LIMIT p_cap
  ),
  public_pools AS (
    SELECT * FROM base WHERE is_public = true AND is_official = false ORDER BY member_count DESC LIMIT p_cap
  ),
  trending AS (
    SELECT * FROM base WHERE recent_joins > 0 ORDER BY recent_joins DESC, member_count DESC LIMIT p_cap
  ),
  by_sport_ranked AS (
    SELECT b.*, row_number() OVER (PARTITION BY b.sport ORDER BY b.member_count DESC) AS rn
    FROM base b WHERE b.sport IS NOT NULL
  ),
  by_sport AS (
    SELECT sport, jsonb_agg(row_to_json(s.*) ORDER BY s.member_count DESC) AS pools
    FROM by_sport_ranked s
    WHERE s.rn <= p_cap
    GROUP BY sport
  )
  SELECT jsonb_build_object(
    'official', (SELECT COALESCE(jsonb_agg(row_to_json(official.*)), '[]'::jsonb) FROM official),
    'public', (SELECT COALESCE(jsonb_agg(row_to_json(public_pools.*)), '[]'::jsonb) FROM public_pools),
    'trending', (SELECT COALESCE(jsonb_agg(row_to_json(trending.*)), '[]'::jsonb) FROM trending),
    'by_sport', (SELECT COALESCE(jsonb_object_agg(sport, pools), '{}'::jsonb) FROM by_sport)
  ) INTO v;
  RETURN v;
END;
$function$

REVOKE EXECUTE ON FUNCTION public.get_discover_sections(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_discover_sections(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_discover_sections(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discover_sections(uuid, integer) TO service_role;


-- ---------------------------------------------------------------------------
-- get_discover_section_all(p_user_id uuid, p_section text, p_limit integer, p_offset integer)
-- Live identity args: p_user_id uuid, p_section text, p_limit integer, p_offset integer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_discover_section_all(p_user_id uuid, p_section text, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb; v_sport text;
BEGIN
  IF p_section LIKE 'sport:%' THEN v_sport := split_part(p_section, ':', 2); END IF;

  WITH base AS (
    SELECT p.id, p.name, p.avatar, p.emblem_url, p.theme_color, p.is_official, p.is_public,
           p.event_id, se.sport, se.name AS event_name,
           (SELECT count(*) FROM public.pool_members pm WHERE pm.pool_id = p.id) AS member_count,
           (SELECT count(*) FROM public.pool_members pm WHERE pm.pool_id = p.id
              AND pm.joined_at >= now() - interval '7 days') AS recent_joins
    FROM public.pools p
    LEFT JOIN public.sporting_events se ON se.id = p.event_id
    WHERE p.accepting_members = true AND (p.is_public = true OR p.is_official = true)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE CASE
      WHEN p_section = 'official' THEN is_official = true
      WHEN p_section = 'public' THEN is_public = true AND is_official = false
      WHEN p_section = 'trending' THEN recent_joins > 0
      WHEN p_section LIKE 'sport:%' THEN sport = v_sport
      ELSE false
    END
    ORDER BY
      CASE WHEN p_section = 'trending' THEN recent_joins ELSE member_count END DESC,
      member_count DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT COALESCE(jsonb_agg(row_to_json(filtered.*)), '[]'::jsonb) INTO v FROM filtered;
  RETURN v;
END;
$function$

REVOKE EXECUTE ON FUNCTION public.get_discover_section_all(uuid, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_discover_section_all(uuid, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_discover_section_all(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discover_section_all(uuid, text, integer, integer) TO service_role;
