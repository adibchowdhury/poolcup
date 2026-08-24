-- Client-safe banned-id lookup for display filtering (leaderboards / pool cards).
-- Returns only banned user ids from the candidate set — no other user columns.
-- Do NOT grant to anon/PUBLIC (past PUBLIC-grant bug).

CREATE OR REPLACE FUNCTION public.get_banned_user_ids_among(p_user_ids uuid[])
 RETURNS uuid[]
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT array_agg(u.id ORDER BY u.id)
      FROM public.users u
      WHERE u.id = ANY (COALESCE(p_user_ids, ARRAY[]::uuid[]))
        AND COALESCE(u.banned, false)
    ),
    ARRAY[]::uuid[]
  );
$function$;

REVOKE ALL ON FUNCTION public.get_banned_user_ids_among(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_banned_user_ids_among(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_banned_user_ids_among(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_banned_user_ids_among(uuid[]) TO service_role;
