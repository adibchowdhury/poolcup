-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent.
--
-- Growth + Commissioner + Custom-Scoring objects.
-- Function bodies dumped from production via pg_get_functiondef (2026-08-12).
-- Contents: 4 tables (+ indexes/RLS/policies), 13 functions, 1 trigger,
-- RLS policy changes (co-commissioner refactor), grants/revokes.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. TABLES (+ indexes + RLS + policies)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pool_join_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  joined_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  inviter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source text DEFAULT 'invite_link'::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, joined_user_id)
);

CREATE INDEX IF NOT EXISTS pja_inviter_idx
  ON public.pool_join_attributions (inviter_id);

CREATE INDEX IF NOT EXISTS pja_pool_idx
  ON public.pool_join_attributions (pool_id);

ALTER TABLE public.pool_join_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pja_read_own ON public.pool_join_attributions;
CREATE POLICY pja_read_own
  ON public.pool_join_attributions
  FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = joined_user_id);

CREATE TABLE IF NOT EXISTS public.pool_admins (
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pool_id, user_id)
);

CREATE INDEX IF NOT EXISTS pool_admins_user_idx
  ON public.pool_admins (user_id);

ALTER TABLE public.pool_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pool_admins_read ON public.pool_admins;
CREATE POLICY pool_admins_read
  ON public.pool_admins
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.pool_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pml_pool_idx
  ON public.pool_moderation_log (pool_id, created_at DESC);

ALTER TABLE public.pool_moderation_log ENABLE ROW LEVEL SECURITY;
-- No policies: service-role reads via RPC only.

CREATE TABLE IF NOT EXISTS public.pool_scoring_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  version integer NOT NULL,
  scoring_style text,
  exact_points integer,
  winner_points integer,
  draw_points integer,
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, version)
);

CREATE INDEX IF NOT EXISTS psv_pool_idx
  ON public.pool_scoring_versions (pool_id, version DESC);

ALTER TABLE public.pool_scoring_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS psv_read ON public.pool_scoring_versions;
CREATE POLICY psv_read
  ON public.pool_scoring_versions
  FOR SELECT
  USING (true);


-- ---------------------------------------------------------------------------
-- 2. FUNCTIONS (verbatim from production pg_get_functiondef)
-- ---------------------------------------------------------------------------

-- get_referral_performance was DROPPED+recreated (return columns changed)
DROP FUNCTION IF EXISTS public.get_referral_performance(uuid, integer);

-- record_pool_join_attribution
CREATE OR REPLACE FUNCTION public.record_pool_join_attribution(p_pool_id uuid, p_joined_user_id uuid, p_inviter_id uuid, p_source text DEFAULT 'invite_link'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_inserted boolean := false;
BEGIN
  IF p_pool_id IS NULL OR p_joined_user_id IS NULL THEN RETURN false; END IF;
  IF p_inviter_id = p_joined_user_id THEN RETURN false; END IF;  -- no self-attribution
  INSERT INTO public.pool_join_attributions (pool_id, joined_user_id, inviter_id, source)
  VALUES (p_pool_id, p_joined_user_id, p_inviter_id, p_source)
  ON CONFLICT (pool_id, joined_user_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$function$;

-- get_referral_performance
CREATE OR REPLACE FUNCTION public.get_referral_performance(p_admin_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(referrer_id uuid, referrer_name text, referrer_username text, signups_referred integer, pool_joins_driven integer, invite_xp_earned integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_id AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH signups AS (
    SELECT r.referrer_id AS rid, count(*)::int AS n FROM public.referrals r GROUP BY r.referrer_id
  ),
  joins AS (
    SELECT pja.inviter_id AS rid, count(*)::int AS n
    FROM public.pool_join_attributions pja WHERE pja.inviter_id IS NOT NULL GROUP BY pja.inviter_id
  ),
  xp AS (
    SELECT xt.user_id AS rid, coalesce(sum(xt.amount),0)::int AS n
    FROM public.xp_transactions xt WHERE xt.source_type = 'invite_accepted' GROUP BY xt.user_id
  ),
  all_referrers AS (
    SELECT rid FROM signups UNION SELECT rid FROM joins UNION SELECT rid FROM xp
  )
  SELECT ar.rid, u.display_name, u.username,
         COALESCE(s.n,0), COALESCE(j.n,0), COALESCE(x.n,0)
  FROM all_referrers ar
  JOIN public.users u ON u.id = ar.rid
  LEFT JOIN signups s ON s.rid = ar.rid
  LEFT JOIN joins j ON j.rid = ar.rid
  LEFT JOIN xp x ON x.rid = ar.rid
  ORDER BY (COALESCE(s.n,0) + COALESCE(j.n,0)) DESC, COALESCE(s.n,0) DESC
  LIMIT greatest(p_limit,1);
END;
$function$;

-- is_pool_owner
CREATE OR REPLACE FUNCTION public.is_pool_owner(p_pool_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.pools WHERE id = p_pool_id AND creator_id = p_user_id);
$function$;

-- is_pool_admin
CREATE OR REPLACE FUNCTION public.is_pool_admin(p_pool_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.pools WHERE id = p_pool_id AND creator_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.pool_admins WHERE pool_id = p_pool_id AND user_id = p_user_id);
$function$;

-- add_co_commissioner
CREATE OR REPLACE FUNCTION public.add_co_commissioner(p_actor_id uuid, p_pool_id uuid, p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_pool_owner(p_pool_id, p_actor_id) THEN
    RAISE EXCEPTION 'not_pool_owner';
  END IF;
  IF public.is_pool_owner(p_pool_id, p_user_id) THEN
    RAISE EXCEPTION 'owner_is_already_admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  INSERT INTO public.pool_admins (pool_id, user_id, added_by)
  VALUES (p_pool_id, p_user_id, p_actor_id)
  ON CONFLICT (pool_id, user_id) DO NOTHING;
  PERFORM public.log_pool_moderation(p_pool_id, p_actor_id, 'co_commissioner_added', p_user_id);
  RETURN 'ok';
END;
$function$;

-- remove_co_commissioner
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
$function$;

-- get_pool_moderation_log
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
  RETURN QUERY
  SELECT l.id, l.actor_id, ua.display_name, l.action, l.target_user_id, ut.display_name, l.detail, l.created_at
  FROM public.pool_moderation_log l
  LEFT JOIN public.users ua ON ua.id = l.actor_id
  LEFT JOIN public.users ut ON ut.id = l.target_user_id
  WHERE l.pool_id = p_pool_id
  ORDER BY l.created_at DESC
  LIMIT greatest(p_limit,1);
END;
$function$;

-- log_pool_moderation
CREATE OR REPLACE FUNCTION public.log_pool_moderation(p_pool_id uuid, p_actor_id uuid, p_action text, p_target_user_id uuid DEFAULT NULL::uuid, p_detail jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO public.pool_moderation_log (pool_id, actor_id, action, target_user_id, detail)
  VALUES (p_pool_id, p_actor_id, p_action, p_target_user_id, COALESCE(p_detail,'{}'::jsonb));
$function$;

-- get_members_missing_predictions
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

  RETURN QUERY
  WITH pool_event AS (
    SELECT event_id FROM public.pools WHERE id = p_pool_id
  ),
  upcoming AS (
    -- upcoming (not yet locked) matches for this pool's event
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
$function$;

-- tg_guard_pool_creator
CREATE OR REPLACE FUNCTION public.tg_guard_pool_creator()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
    IF COALESCE(current_setting('poolcup.allow_owner_transfer', true), 'off') <> 'on' THEN
      RAISE EXCEPTION 'creator_id can only be changed via transfer_pool_ownership';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- transfer_pool_ownership
CREATE OR REPLACE FUNCTION public.transfer_pool_ownership(p_pool_id uuid, p_new_owner_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_is_creator boolean; v_new_is_member boolean; v_actor uuid := auth.uid();
BEGIN
  SELECT (creator_id = v_actor) INTO v_is_creator FROM public.pools WHERE id = p_pool_id;
  IF NOT coalesce(v_is_creator, false) THEN
    RAISE EXCEPTION 'not_pool_creator';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = p_new_owner_user_id)
  INTO v_new_is_member;
  IF NOT v_new_is_member THEN
    RAISE EXCEPTION 'new_owner_not_member';
  END IF;

  IF p_new_owner_user_id = v_actor THEN
    RAISE EXCEPTION 'cannot_transfer_to_self';
  END IF;

  -- allow the creator_id change through the guard trigger for this transaction only
  PERFORM set_config('poolcup.allow_owner_transfer', 'on', true);
  UPDATE public.pools SET creator_id = p_new_owner_user_id WHERE id = p_pool_id;
  PERFORM set_config('poolcup.allow_owner_transfer', 'off', true);

  -- the new owner should no longer also be a co-commissioner (they're owner now)
  DELETE FROM public.pool_admins WHERE pool_id = p_pool_id AND user_id = p_new_owner_user_id;

  PERFORM public.log_pool_moderation(p_pool_id, v_actor, 'ownership_transferred', p_new_owner_user_id);
END;
$function$;

-- record_scoring_version
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
  SELECT COALESCE(max(version),0) + 1 INTO v_next FROM public.pool_scoring_versions WHERE pool_id = p_pool_id;
  INSERT INTO public.pool_scoring_versions (pool_id, version, scoring_style, exact_points, winner_points, draw_points, changed_by)
  VALUES (p_pool_id, v_next, p_style, p_exact, p_winner, p_draw, p_actor_id);
  RETURN v_next;
END;
$function$;

-- recalculate_pool_scoring
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
$function$;

-- ---------------------------------------------------------------------------
-- 3. TRIGGER
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS guard_pool_creator ON public.pools;
CREATE TRIGGER guard_pool_creator
  BEFORE UPDATE ON public.pools
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_guard_pool_creator();


-- ---------------------------------------------------------------------------
-- 4. RLS POLICY CHANGES (co-commissioner refactor; replaced creator-only)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS pools_update ON public.pools;
CREATE POLICY pools_update
  ON public.pools
  FOR UPDATE
  USING (public.is_pool_admin(id, auth.uid()))
  WITH CHECK (public.is_pool_admin(id, auth.uid()));

DROP POLICY IF EXISTS pool_announcements_insert ON public.pool_announcements;
CREATE POLICY pool_announcements_insert
  ON public.pool_announcements
  FOR INSERT
  WITH CHECK (auth.uid() = author_id AND public.is_pool_admin(pool_id, auth.uid()));

DROP POLICY IF EXISTS pool_announcements_update ON public.pool_announcements;
CREATE POLICY pool_announcements_update
  ON public.pool_announcements
  FOR UPDATE
  USING (public.is_pool_admin(pool_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 5. GRANTS / REVOKES (live privilege state)
-- ---------------------------------------------------------------------------

-- service_role only
REVOKE EXECUTE ON FUNCTION public.record_pool_join_attribution(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pool_join_attribution(uuid, uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_referral_performance(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_performance(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.add_co_commissioner(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_co_commissioner(uuid, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.remove_co_commissioner(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_co_commissioner(uuid, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_pool_moderation_log(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pool_moderation_log(uuid, uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_pool_moderation(uuid, uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_pool_moderation(uuid, uuid, text, uuid, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_members_missing_predictions(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_members_missing_predictions(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_scoring_version(uuid, uuid, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_scoring_version(uuid, uuid, text, integer, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.recalculate_pool_scoring(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_pool_scoring(uuid, uuid) TO service_role;

-- authenticated + service_role
GRANT EXECUTE ON FUNCTION public.is_pool_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_pool_admin(uuid, uuid) TO authenticated, service_role;

-- tg_guard_pool_creator: trigger function — no direct EXECUTE for clients
REVOKE EXECUTE ON FUNCTION public.tg_guard_pool_creator() FROM PUBLIC, anon, authenticated;

-- transfer_pool_ownership: leave as-is (SECURITY DEFINER).
-- Live EXECUTE grants (verified): anon, authenticated, postgres, service_role.
