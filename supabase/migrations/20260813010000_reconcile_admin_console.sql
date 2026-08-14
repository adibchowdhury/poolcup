-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent where possible.
--
-- Admin Console objects (audit log, activity tracking, helpers, RPCs,
-- ban-enforcement write policies + cast_poll_vote).
-- Function bodies dumped from production via pg_get_functiondef (2026-08-13).
-- Policies dumped from live pg_policy / pg_get_expr.
-- Contents: admin_audit_log + 3 indexes, last_active_at + index,
-- 4 helper fns, 12 admin RPCs, 4 write policies, cast_poll_vote.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. ADMIN AUDIT LOG TABLE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_created_idx
  ON public.admin_audit_log USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_admin_idx
  ON public.admin_audit_log USING btree (admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_target_idx
  ON public.admin_audit_log USING btree (target_type, target_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies: locked (service_role / SECURITY DEFINER writers only).


-- ---------------------------------------------------------------------------
-- 2. ACTIVITY TRACKING
-- ---------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE INDEX IF NOT EXISTS users_last_active_idx
  ON public.users USING btree (last_active_at)
  WHERE (last_active_at IS NOT NULL);


-- ---------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS (verbatim via pg_get_functiondef)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_site_admin(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_admin = true);
$function$

REVOKE ALL ON FUNCTION public.is_site_admin(p_user_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_site_admin(p_user_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_site_admin(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_site_admin(p_user_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_user_banned(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND banned = true);
$function$

REVOKE ALL ON FUNCTION public.is_user_banned(p_user_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_banned(p_user_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_user_banned(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_banned(p_user_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.touch_user_activity(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow touching your own row (the calling user's id must match, enforced by the app passing
  -- the authed user's id; this is a low-sensitivity write). Update only if stale (> 5 min) to reduce writes.
  UPDATE public.users
  SET last_active_at = now()
  WHERE id = p_user_id
    AND (last_active_at IS NULL OR last_active_at < now() - interval '5 minutes');
END;
$function$

REVOKE ALL ON FUNCTION public.touch_user_activity(p_user_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_user_activity(p_user_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.touch_user_activity(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_user_activity(p_user_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.log_admin_action(p_admin_id uuid, p_action text, p_target_type text DEFAULT NULL::text, p_target_id text DEFAULT NULL::text, p_detail jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, detail)
  VALUES (p_admin_id, p_action, p_target_type, p_target_id, p_detail);
END;
$function$

REVOKE ALL ON FUNCTION public.log_admin_action(p_admin_id uuid, p_action text, p_target_type text, p_target_id text, p_detail jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_admin_action(p_admin_id uuid, p_action text, p_target_type text, p_target_id text, p_detail jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.log_admin_action(p_admin_id uuid, p_action text, p_target_type text, p_target_id text, p_detail jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(p_admin_id uuid, p_action text, p_target_type text, p_target_id text, p_detail jsonb) TO service_role;


-- ---------------------------------------------------------------------------
-- 4. ADMIN CONSOLE RPCs (verbatim; service_role only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_get_metrics(p_admin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.users),
    'dau', (SELECT count(*) FROM public.users WHERE last_active_at > now() - interval '24 hours'),
    'predictions_today', (SELECT count(*) FROM public.predictions WHERE submitted_at >= date_trunc('day', now())),
    'pools_created_today', (SELECT count(*) FROM public.pools WHERE created_at >= date_trunc('day', now())),
    'subs_free', (SELECT count(*) FROM public.users WHERE tier = 'free'),
    'subs_pro', (SELECT count(*) FROM public.users WHERE tier = 'pro' AND subscription_status IN ('active','past_due','trialing')),
    'subs_commissioner', (SELECT count(*) FROM public.users WHERE tier = 'commissioner' AND subscription_status IN ('active','past_due','trialing')),
    'mrr_estimate', (
      (SELECT count(*) FROM public.users WHERE tier = 'pro' AND subscription_status IN ('active','past_due','trialing')) * 4.99
      + (SELECT count(*) FROM public.users WHERE tier = 'commissioner' AND subscription_status IN ('active','past_due','trialing')) * 9.99
    ),
    'total_pools', (SELECT count(*) FROM public.pools),
    'total_predictions', (SELECT count(*) FROM public.predictions),
    'banned_users', (SELECT count(*) FROM public.users WHERE banned = true)
  ) INTO v;

  RETURN v;
END;
$function$

REVOKE ALL ON FUNCTION public.admin_get_metrics(p_admin_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_metrics(p_admin_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_get_metrics(p_admin_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_metrics(p_admin_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_user_lookup(p_admin_id uuid, p_query text, p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, username text, display_name text, email text, tier text, banned boolean, created_at timestamp with time zone, last_active_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF p_query IS NULL OR length(trim(p_query)) = 0 THEN RETURN; END IF;

  RETURN QUERY
  SELECT u.id, u.username, u.display_name, u.email, u.tier, u.banned, u.created_at, u.last_active_at
  FROM public.users u
  WHERE u.email ILIKE '%'||trim(p_query)||'%'
     OR u.username ILIKE '%'||trim(p_query)||'%'
     OR u.display_name ILIKE '%'||trim(p_query)||'%'
     OR u.id::text = trim(p_query)
  ORDER BY u.created_at DESC
  LIMIT greatest(p_limit,1);
END;
$function$

REVOKE ALL ON FUNCTION public.admin_user_lookup(p_admin_id uuid, p_query text, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_user_lookup(p_admin_id uuid, p_query text, p_limit integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_user_lookup(p_admin_id uuid, p_query text, p_limit integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_lookup(p_admin_id uuid, p_query text, p_limit integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_user_detail(p_admin_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;

  SELECT jsonb_build_object(
    'profile', (SELECT jsonb_build_object(
        'id', u.id, 'username', u.username, 'display_name', u.display_name, 'email', u.email,
        'tier', u.tier, 'subscription_status', u.subscription_status, 'stripe_customer_id', u.stripe_customer_id,
        'banned', u.banned, 'is_admin', u.is_admin, 'created_at', u.created_at, 'last_active_at', u.last_active_at,
        'points', u.points, 'is_supporter', u.is_supporter
      ) FROM public.users u WHERE u.id = p_user_id),
    'pools_owned', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'created_at', p.created_at) ORDER BY p.created_at DESC), '[]'::jsonb)
      FROM public.pools p WHERE p.creator_id = p_user_id),
    'pools_joined_count', (SELECT count(*) FROM public.pool_members pm WHERE pm.user_id = p_user_id),
    'recent_predictions', (SELECT COALESCE(jsonb_agg(rp), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('match_id', pr.match_id, 'pred', pr.pred_team1||'-'||pr.pred_team2,
          'points', pr.points_awarded, 'submitted_at', pr.submitted_at) AS rp
        FROM public.predictions pr WHERE pr.member_id IN (SELECT id FROM public.pool_members WHERE user_id = p_user_id)
        ORDER BY pr.submitted_at DESC NULLS LAST LIMIT 10
      ) sub)
  ) INTO v;

  RETURN v;
END;
$function$

REVOKE ALL ON FUNCTION public.admin_user_detail(p_admin_id uuid, p_user_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_user_detail(p_admin_id uuid, p_user_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_user_detail(p_admin_id uuid, p_user_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(p_admin_id uuid, p_user_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_ban_user(p_admin_id uuid, p_target_user_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF p_target_user_id IS NULL THEN RAISE EXCEPTION 'no_target'; END IF;
  -- Prevent an admin from banning another admin (safety; unban path can fix if needed).
  IF public.is_site_admin(p_target_user_id) THEN RAISE EXCEPTION 'cannot_ban_admin'; END IF;

  UPDATE public.users SET banned = true WHERE id = p_target_user_id;
  PERFORM public.log_admin_action(p_admin_id, 'user_banned', 'user', p_target_user_id::text,
    jsonb_build_object('reason', p_reason));
END;
$function$

REVOKE ALL ON FUNCTION public.admin_ban_user(p_admin_id uuid, p_target_user_id uuid, p_reason text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_ban_user(p_admin_id uuid, p_target_user_id uuid, p_reason text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_ban_user(p_admin_id uuid, p_target_user_id uuid, p_reason text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(p_admin_id uuid, p_target_user_id uuid, p_reason text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_unban_user(p_admin_id uuid, p_target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.users SET banned = false WHERE id = p_target_user_id;
  PERFORM public.log_admin_action(p_admin_id, 'user_unbanned', 'user', p_target_user_id::text, NULL);
END;
$function$

REVOKE ALL ON FUNCTION public.admin_unban_user(p_admin_id uuid, p_target_user_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unban_user(p_admin_id uuid, p_target_user_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_unban_user(p_admin_id uuid, p_target_user_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(p_admin_id uuid, p_target_user_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_pool_lookup(p_admin_id uuid, p_query text, p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, name text, invite_code text, creator_id uuid, creator_name text, member_count integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF p_query IS NULL OR length(trim(p_query)) = 0 THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.name, p.invite_code, p.creator_id, u.display_name,
    (SELECT count(*)::int FROM public.pool_members pm WHERE pm.pool_id = p.id), p.created_at
  FROM public.pools p LEFT JOIN public.users u ON u.id = p.creator_id
  WHERE p.name ILIKE '%'||trim(p_query)||'%' OR p.invite_code ILIKE '%'||trim(p_query)||'%' OR p.id::text = trim(p_query)
  ORDER BY p.created_at DESC LIMIT greatest(p_limit,1);
END;
$function$

REVOKE ALL ON FUNCTION public.admin_pool_lookup(p_admin_id uuid, p_query text, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_pool_lookup(p_admin_id uuid, p_query text, p_limit integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_pool_lookup(p_admin_id uuid, p_query text, p_limit integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pool_lookup(p_admin_id uuid, p_query text, p_limit integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_pool_detail(p_admin_id uuid, p_pool_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT jsonb_build_object(
    'pool', (SELECT jsonb_build_object('id', p.id, 'name', p.name, 'invite_code', p.invite_code,
        'creator_id', p.creator_id, 'is_public', p.is_public, 'created_at', p.created_at,
        'scoring_style', p.scoring_style, 'event_id', p.event_id) FROM public.pools p WHERE p.id = p_pool_id),
    'owner', (SELECT jsonb_build_object('id', u.id, 'display_name', u.display_name, 'email', u.email, 'tier', u.tier)
        FROM public.pools p JOIN public.users u ON u.id = p.creator_id WHERE p.id = p_pool_id),
    'member_count', (SELECT count(*) FROM public.pool_members WHERE pool_id = p_pool_id),
    'co_commissioners', (SELECT count(*) FROM public.pool_admins WHERE pool_id = p_pool_id)
  ) INTO v;
  RETURN v;
END;
$function$

REVOKE ALL ON FUNCTION public.admin_pool_detail(p_admin_id uuid, p_pool_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_pool_detail(p_admin_id uuid, p_pool_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_pool_detail(p_admin_id uuid, p_pool_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pool_detail(p_admin_id uuid, p_pool_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_close_pool(p_admin_id uuid, p_pool_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.pools SET is_public = false WHERE id = p_pool_id;
  PERFORM public.log_admin_action(p_admin_id, 'pool_closed', 'pool', p_pool_id::text, NULL);
END;
$function$

REVOKE ALL ON FUNCTION public.admin_close_pool(p_admin_id uuid, p_pool_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_close_pool(p_admin_id uuid, p_pool_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_close_pool(p_admin_id uuid, p_pool_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_close_pool(p_admin_id uuid, p_pool_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_match_lookup(p_admin_id uuid, p_query text, p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, team1_name text, team2_name text, result_team1 integer, result_team2 integer, is_final boolean, kickoff_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF p_query IS NULL OR length(trim(p_query)) = 0 THEN RETURN; END IF;
  RETURN QUERY
  SELECT m.id, m.team1_name, m.team2_name, m.result_team1, m.result_team2, m.is_final, m.kickoff_at
  FROM public.matches m
  WHERE m.team1_name ILIKE '%'||trim(p_query)||'%' OR m.team2_name ILIKE '%'||trim(p_query)||'%' OR m.id::text = trim(p_query)
  ORDER BY m.kickoff_at DESC LIMIT greatest(p_limit,1);
END;
$function$

REVOKE ALL ON FUNCTION public.admin_match_lookup(p_admin_id uuid, p_query text, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_match_lookup(p_admin_id uuid, p_query text, p_limit integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_match_lookup(p_admin_id uuid, p_query text, p_limit integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_match_lookup(p_admin_id uuid, p_query text, p_limit integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_refresh_match_scoring(p_admin_id uuid, p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  PERFORM public.calculate_match_points(p_match_id);
  PERFORM public.log_admin_action(p_admin_id, 'result_refreshed', 'match', p_match_id::text, NULL);
END;
$function$

REVOKE ALL ON FUNCTION public.admin_refresh_match_scoring(p_admin_id uuid, p_match_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_refresh_match_scoring(p_admin_id uuid, p_match_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_refresh_match_scoring(p_admin_id uuid, p_match_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refresh_match_scoring(p_admin_id uuid, p_match_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_failed_webhooks(p_admin_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(stripe_event_id text, event_type text, status text, error text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN QUERY
  SELECT e.stripe_event_id, e.event_type, e.status, e.error, e.created_at
  FROM public.stripe_webhook_events e WHERE e.status = 'failed'
  ORDER BY e.created_at DESC LIMIT greatest(p_limit,1);
END;
$function$

REVOKE ALL ON FUNCTION public.admin_failed_webhooks(p_admin_id uuid, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_failed_webhooks(p_admin_id uuid, p_limit integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_failed_webhooks(p_admin_id uuid, p_limit integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_failed_webhooks(p_admin_id uuid, p_limit integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_audit_log(p_admin_id uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, admin_id uuid, admin_name text, action text, target_type text, target_id text, detail jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN QUERY
  SELECT l.id, l.admin_id, u.display_name, l.action, l.target_type, l.target_id, l.detail, l.created_at
  FROM public.admin_audit_log l LEFT JOIN public.users u ON u.id = l.admin_id
  ORDER BY l.created_at DESC LIMIT greatest(p_limit,1);
END;
$function$

REVOKE ALL ON FUNCTION public.admin_get_audit_log(p_admin_id uuid, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_audit_log(p_admin_id uuid, p_limit integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_get_audit_log(p_admin_id uuid, p_limit integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_log(p_admin_id uuid, p_limit integer) TO service_role;


-- ---------------------------------------------------------------------------
-- 5. BAN ENFORCEMENT — WRITE POLICY CHANGES (live definitions)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS predictions_write ON public.predictions;
CREATE POLICY predictions_write
  ON public.predictions
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM pool_members
  WHERE ((pool_members.user_id = auth.uid()) AND (pool_members.id = predictions.member_id)))) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = predictions.match_id) AND ((m.locked_at IS NULL) OR (m.locked_at > now()))))) AND (NOT is_user_banned(auth.uid()))));

DROP POLICY IF EXISTS members_insert ON public.pool_members;
CREATE POLICY members_insert
  ON public.pool_members
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM pools p
  WHERE ((p.id = pool_members.pool_id) AND (p.accepting_members OR (p.creator_id = auth.uid()))))) AND (NOT is_user_banned(auth.uid()))));

DROP POLICY IF EXISTS "members add own reactions" ON public.message_reactions;
CREATE POLICY "members add own reactions"
  ON public.message_reactions
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.pool_id = message_reactions.pool_id) AND (pm.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM pool_messages m
  WHERE ((m.id = message_reactions.message_id) AND (m.pool_id = message_reactions.pool_id)))) AND (NOT is_user_banned(auth.uid()))));

DROP POLICY IF EXISTS "members send pool messages" ON public.pool_messages;
CREATE POLICY "members send pool messages"
  ON public.pool_messages
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.pool_id = pool_messages.pool_id) AND (pm.user_id = auth.uid())))) AND (( SELECT count(*) AS count
   FROM pool_messages m
  WHERE ((m.user_id = auth.uid()) AND (m.created_at > (now() - '00:00:10'::interval)))) < 10) AND (NOT is_user_banned(auth.uid()))));


-- ---------------------------------------------------------------------------
-- 6. BAN ENFORCEMENT — cast_poll_vote (verbatim; includes is_user_banned)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_user_id uuid, p_poll_id uuid, p_option_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pool uuid; v_closes timestamptz; v_active boolean;
BEGIN
  IF public.is_user_banned(p_user_id) THEN RAISE EXCEPTION 'user_banned'; END IF;
  SELECT pool_id, closes_at, is_active INTO v_pool, v_closes, v_active FROM public.polls WHERE id = p_poll_id;
  IF v_pool IS NULL OR NOT v_active THEN RAISE EXCEPTION 'poll_not_available'; END IF;
  IF v_closes IS NOT NULL AND v_closes <= now() THEN RAISE EXCEPTION 'poll_closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pool_members WHERE pool_id = v_pool AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.poll_options WHERE id = p_option_id AND poll_id = p_poll_id) THEN
    RAISE EXCEPTION 'invalid_option';
  END IF;
  INSERT INTO public.poll_votes (poll_id, user_id, option_id, voted_at)
  VALUES (p_poll_id, p_user_id, p_option_id, now())
  ON CONFLICT (poll_id, user_id) DO UPDATE SET option_id = EXCLUDED.option_id, voted_at = now();
END;
$function$

REVOKE ALL ON FUNCTION public.cast_poll_vote(p_user_id uuid, p_poll_id uuid, p_option_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cast_poll_vote(p_user_id uuid, p_poll_id uuid, p_option_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cast_poll_vote(p_user_id uuid, p_poll_id uuid, p_option_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(p_user_id uuid, p_poll_id uuid, p_option_id uuid) TO service_role;
