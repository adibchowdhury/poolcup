-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent where possible.
--
-- Reconciles Moderation / Abuse-Controls objects as of live linked prod dump.
-- Bodies/policies/constraints pulled via pg_get_functiondef / pg_get_expr / pg_get_constraintdef.

-- =============================================================================
-- 1. REPORT RESOLUTION COLUMNS
-- =============================================================================

ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_note text;

ALTER TABLE public.message_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_note text;

CREATE INDEX IF NOT EXISTS user_reports_status_idx
  ON public.user_reports USING btree (status, created_at DESC);

CREATE INDEX IF NOT EXISTS message_reports_status_idx
  ON public.message_reports USING btree (status, created_at DESC);

-- =============================================================================
-- 2. POOL REPORTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pool_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  reason text NOT NULL,
  context text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pool_reports_status_idx
  ON public.pool_reports USING btree (status, created_at DESC);

CREATE INDEX IF NOT EXISTS pool_reports_pool_idx
  ON public.pool_reports USING btree (reported_pool_id);

ALTER TABLE public.pool_reports ENABLE ROW LEVEL SECURITY;
-- RLS enabled; no policies (service_role / SECURITY DEFINER only)

CREATE OR REPLACE FUNCTION public.report_pool(p_reporter_id uuid, p_pool_id uuid, p_reason text, p_context text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_reporter_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF public.is_user_banned(p_reporter_id) THEN RAISE EXCEPTION 'user_banned'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;
  -- duplicate guard: same reporter+pool within 24h
  IF EXISTS (SELECT 1 FROM public.pool_reports
             WHERE reporter_id = p_reporter_id AND reported_pool_id = p_pool_id
               AND created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'already_reported';
  END IF;
  INSERT INTO public.pool_reports (reporter_id, reported_pool_id, reason, context)
  VALUES (p_reporter_id, p_pool_id, trim(p_reason), p_context);
END;
$function$
;

REVOKE ALL ON FUNCTION public.report_pool(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_pool(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_pool(uuid, uuid, text, text) TO service_role;

-- =============================================================================
-- 3. MODERATION QUEUE RPCs (service_role only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_report_queue(p_admin_id uuid, p_status text DEFAULT 'open'::text, p_type text DEFAULT 'all'::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(report_type text, report_id uuid, reporter_id uuid, reporter_name text, target_id text, target_label text, reason text, context text, status text, resolution_note text, resolved_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;

  RETURN QUERY
  -- USER reports
  SELECT 'user'::text, ur.id, ur.reporter_id, ru.display_name,
    ur.reported_user_id::text, tu.display_name, ur.reason, ur.context, ur.status,
    ur.resolution_note, ur.resolved_at, ur.created_at
  FROM public.user_reports ur
  LEFT JOIN public.users ru ON ru.id = ur.reporter_id
  LEFT JOIN public.users tu ON tu.id = ur.reported_user_id
  WHERE (p_type IN ('all','user'))
    AND (p_status = 'all' OR ur.status = p_status)

  UNION ALL
  -- MESSAGE reports
  SELECT 'message'::text, mr.id, mr.reporter_id, ru.display_name,
    mr.message_id::text, ('msg by '||COALESCE(au.display_name,'?')||': '||left(mr.reported_content, 80)),
    mr.reason, NULL, mr.status, mr.resolution_note, mr.resolved_at, mr.created_at
  FROM public.message_reports mr
  LEFT JOIN public.users ru ON ru.id = mr.reporter_id
  LEFT JOIN public.users au ON au.id = mr.reported_author_id
  WHERE (p_type IN ('all','message'))
    AND (p_status = 'all' OR mr.status = p_status)

  UNION ALL
  -- POOL reports
  SELECT 'pool'::text, pr.id, pr.reporter_id, ru.display_name,
    pr.reported_pool_id::text, p.name, pr.reason, pr.context, pr.status,
    pr.resolution_note, pr.resolved_at, pr.created_at
  FROM public.pool_reports pr
  LEFT JOIN public.users ru ON ru.id = pr.reporter_id
  LEFT JOIN public.pools p ON p.id = pr.reported_pool_id
  WHERE (p_type IN ('all','pool'))
    AND (p_status = 'all' OR pr.status = p_status)

  ORDER BY created_at DESC
  LIMIT greatest(p_limit,1);
END;
$function$
;

REVOKE ALL ON FUNCTION public.admin_get_report_queue(uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_report_queue(uuid, text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_admin_id uuid, p_report_type text, p_report_id uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_site_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;

  IF p_report_type = 'user' THEN
    UPDATE public.user_reports SET status='resolved', resolved_by=p_admin_id, resolved_at=now(), resolution_note=p_note WHERE id=p_report_id;
  ELSIF p_report_type = 'message' THEN
    UPDATE public.message_reports SET status='resolved', resolved_by=p_admin_id, resolved_at=now(), resolution_note=p_note WHERE id=p_report_id;
  ELSIF p_report_type = 'pool' THEN
    UPDATE public.pool_reports SET status='resolved', resolved_by=p_admin_id, resolved_at=now(), resolution_note=p_note WHERE id=p_report_id;
  ELSE
    RAISE EXCEPTION 'invalid_report_type';
  END IF;

  PERFORM public.log_admin_action(p_admin_id, 'report_resolved', p_report_type, p_report_id::text,
    jsonb_build_object('note', p_note));
END;
$function$
;

REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, uuid, text) TO service_role;

-- =============================================================================
-- 4. RATE LIMITING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_lookup_idx
  ON public.rate_limit_events USING btree (action, subject, created_at DESC);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
-- RLS enabled; no policies (service_role / SECURITY DEFINER only)

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_action text, p_subject text, p_max integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  -- count recent attempts in the window
  SELECT count(*) INTO v_count FROM public.rate_limit_events
  WHERE action = p_action AND subject = p_subject
    AND created_at > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max THEN
    RETURN false;  -- blocked
  END IF;

  -- record this attempt and allow
  INSERT INTO public.rate_limit_events (action, subject) VALUES (p_action, p_subject);
  RETURN true;
END;
$function$
;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_events()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.rate_limit_events WHERE created_at < now() - interval '1 day';
$function$
;

REVOKE ALL ON FUNCTION public.cleanup_rate_limit_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_events() TO service_role;

-- =============================================================================
-- 5. UGC LENGTH CHECK CONSTRAINTS (live ceilings)
-- Live defs (verbatim from pg_get_constraintdef):
--   pools_name_len_chk:           char_length(name) <= 100
--   pools_desc_len_chk:           char_length(COALESCE(description,'')) <= 500
--   users_display_name_len_chk:   char_length(COALESCE(display_name,'')) <= 60
--   pool_messages_len_chk:        char_length(content) <= 1000
--   pool_announcements_len_chk:   char_length(message) <= 1000
--   dm_messages_len_chk:          char_length(content) <= 1000
-- App validators may be stricter; DB CHECK is the hard ceiling.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pools_name_len_chk') THEN
    ALTER TABLE public.pools ADD CONSTRAINT pools_name_len_chk CHECK ((char_length(name) <= 100));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pools_desc_len_chk') THEN
    ALTER TABLE public.pools ADD CONSTRAINT pools_desc_len_chk CHECK ((char_length(COALESCE(description, ''::text)) <= 500));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_display_name_len_chk') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_display_name_len_chk CHECK ((char_length(COALESCE(display_name, ''::text)) <= 60));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pool_messages_len_chk') THEN
    ALTER TABLE public.pool_messages ADD CONSTRAINT pool_messages_len_chk CHECK ((char_length(content) <= 1000));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pool_announcements_len_chk') THEN
    ALTER TABLE public.pool_announcements ADD CONSTRAINT pool_announcements_len_chk CHECK ((char_length(message) <= 1000));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dm_messages_len_chk') THEN
    ALTER TABLE public.dm_messages ADD CONSTRAINT dm_messages_len_chk CHECK ((char_length(content) <= 1000));
  END IF;
END
$$;

-- =============================================================================
-- 6. RLS SECURITY HELPERS + TIGHTENED POLICIES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_pool_member(p_pool_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.pool_members pm WHERE pm.pool_id = p_pool_id AND pm.user_id = p_user_id);
$function$
;

-- Live grants include PUBLIC + anon + authenticated + service_role (needed for RLS quals).
REVOKE ALL ON FUNCTION public.is_pool_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pool_member(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_pool_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pool_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_pool_member(uuid, uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION public.can_read_pool(p_pool_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pools p
    WHERE p.id = p_pool_id
      AND (p.is_public = true OR p.creator_id = p_user_id
           OR EXISTS (SELECT 1 FROM public.pool_members pm WHERE pm.pool_id = p.id AND pm.user_id = p_user_id))
  );
$function$
;

REVOKE ALL ON FUNCTION public.can_read_pool(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_pool(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.can_read_pool(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_pool(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_read_pool(uuid, uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION public.has_muted(p_viewer uuid, p_author uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_mutes WHERE user_id = p_viewer AND muted_user_id = p_author);
$function$
;

REVOKE ALL ON FUNCTION public.has_muted(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_muted(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_muted(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.has_block_between(p_user_a uuid, p_user_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (user_id = p_user_a AND blocked_user_id = p_user_b)
       OR (user_id = p_user_b AND blocked_user_id = p_user_a)
  );
$function$
;

REVOKE ALL ON FUNCTION public.has_block_between(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_block_between(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_block_between(uuid, uuid) TO service_role;

-- pools_read (verbatim using_expr from live)
DROP POLICY IF EXISTS pools_read ON public.pools;
CREATE POLICY pools_read ON public.pools
  AS PERMISSIVE FOR SELECT TO public
  USING (((is_public = true) OR (creator_id = auth.uid()) OR is_pool_member(id, auth.uid())));

-- members_read (verbatim using_expr from live)
DROP POLICY IF EXISTS members_read ON public.pool_members;
CREATE POLICY members_read ON public.pool_members
  AS PERMISSIVE FOR SELECT TO public
  USING (can_read_pool(pool_id, auth.uid()));
