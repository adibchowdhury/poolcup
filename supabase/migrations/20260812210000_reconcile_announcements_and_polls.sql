-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent.
--
-- Announcements additions (pinned/updated_at) + Polls objects.
-- Function bodies dumped from production via pg_get_functiondef (2026-08-13).
-- Contents: 2 announcement columns + index, 3 polls tables (+ indexes/RLS),
-- 6 functions, 1 trigger, grants/revokes (+ tg_guard_pool_creator carryover).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. ANNOUNCEMENTS COLUMNS
-- ---------------------------------------------------------------------------

ALTER TABLE public.pool_announcements
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

ALTER TABLE public.pool_announcements
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE INDEX IF NOT EXISTS pool_announcements_pool_active_idx
  ON public.pool_announcements (pool_id, pinned DESC, created_at DESC)
  WHERE is_active;


-- ---------------------------------------------------------------------------
-- 2. POLLS TABLES (+ indexes + RLS + member-read policies)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  closes_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS polls_pool_idx
  ON public.polls (pool_id, created_at DESC)
  WHERE is_active;

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS polls_read_members ON public.polls;
CREATE POLICY polls_read_members
  ON public.polls
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pool_members pm
      WHERE pm.pool_id = polls.pool_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS poll_options_poll_idx
  ON public.poll_options (poll_id, sort_order);

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_options_read_members ON public.poll_options;
CREATE POLICY poll_options_read_members
  ON public.poll_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.polls p
      JOIN public.pool_members pm ON pm.pool_id = p.pool_id
      WHERE p.id = poll_options.poll_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.poll_votes (
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS poll_votes_option_idx
  ON public.poll_votes (option_id);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_votes_read_members ON public.poll_votes;
CREATE POLICY poll_votes_read_members
  ON public.poll_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.polls p
      JOIN public.pool_members pm ON pm.pool_id = p.pool_id
      WHERE p.id = poll_votes.poll_id
        AND pm.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- 3. FUNCTIONS (verbatim from production pg_get_functiondef)
-- ---------------------------------------------------------------------------

-- set_announcement_pinned
CREATE OR REPLACE FUNCTION public.set_announcement_pinned(p_actor_id uuid, p_announcement_id uuid, p_pinned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pool uuid;
BEGIN
  SELECT pool_id INTO v_pool FROM public.pool_announcements WHERE id = p_announcement_id;
  IF v_pool IS NULL THEN RAISE EXCEPTION 'announcement_not_found'; END IF;
  IF NOT public.is_pool_admin(v_pool, p_actor_id) THEN RAISE EXCEPTION 'not_pool_admin'; END IF;

  IF p_pinned THEN
    -- unpin any currently-pinned announcement in this pool, then pin this one
    UPDATE public.pool_announcements SET pinned = false WHERE pool_id = v_pool AND pinned = true;
    UPDATE public.pool_announcements SET pinned = true WHERE id = p_announcement_id;
  ELSE
    UPDATE public.pool_announcements SET pinned = false WHERE id = p_announcement_id;
  END IF;
END;
$function$;

-- tg_announcement_updated_at
CREATE OR REPLACE FUNCTION public.tg_announcement_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

-- create_poll
CREATE OR REPLACE FUNCTION public.create_poll(p_actor_id uuid, p_pool_id uuid, p_question text, p_options text[], p_closes_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_poll uuid; i integer;
BEGIN
  IF NOT public.is_pool_admin(p_pool_id, p_actor_id) THEN RAISE EXCEPTION 'not_pool_admin'; END IF;
  IF p_question IS NULL OR length(trim(p_question)) = 0 THEN RAISE EXCEPTION 'empty_question'; END IF;
  IF array_length(p_options,1) IS NULL OR array_length(p_options,1) < 2 THEN RAISE EXCEPTION 'need_at_least_2_options'; END IF;
  IF array_length(p_options,1) > 10 THEN RAISE EXCEPTION 'too_many_options'; END IF;

  INSERT INTO public.polls (pool_id, author_id, question, closes_at)
  VALUES (p_pool_id, p_actor_id, trim(p_question), p_closes_at) RETURNING id INTO v_poll;

  FOR i IN 1..array_length(p_options,1) LOOP
    IF length(trim(p_options[i])) > 0 THEN
      INSERT INTO public.poll_options (poll_id, label, sort_order) VALUES (v_poll, trim(p_options[i]), i);
    END IF;
  END LOOP;

  RETURN v_poll;
END;
$function$;

-- cast_poll_vote
CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_user_id uuid, p_poll_id uuid, p_option_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pool uuid; v_closes timestamptz; v_active boolean;
BEGIN
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
$function$;

-- delete_poll
CREATE OR REPLACE FUNCTION public.delete_poll(p_actor_id uuid, p_poll_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pool uuid;
BEGIN
  SELECT pool_id INTO v_pool FROM public.polls WHERE id = p_poll_id;
  IF v_pool IS NULL THEN RAISE EXCEPTION 'poll_not_found'; END IF;
  IF NOT public.is_pool_admin(v_pool, p_actor_id) THEN RAISE EXCEPTION 'not_pool_admin'; END IF;
  UPDATE public.polls SET is_active = false WHERE id = p_poll_id;
  PERFORM public.log_pool_moderation(v_pool, p_actor_id, 'poll_deleted', NULL, jsonb_build_object('poll_id', p_poll_id));
END;
$function$;

-- get_pool_polls
CREATE OR REPLACE FUNCTION public.get_pool_polls(p_user_id uuid, p_pool_id uuid)
 RETURNS TABLE(poll_id uuid, question text, closes_at timestamp with time zone, is_closed boolean, created_at timestamp with time zone, total_votes integer, my_option_id uuid, options jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.question, p.closes_at,
    (p.closes_at IS NOT NULL AND p.closes_at <= now()) AS is_closed,
    p.created_at,
    (SELECT count(*)::int FROM public.poll_votes v WHERE v.poll_id = p.id) AS total_votes,
    (SELECT v.option_id FROM public.poll_votes v WHERE v.poll_id = p.id AND v.user_id = p_user_id) AS my_option_id,
    (SELECT jsonb_agg(jsonb_build_object(
        'option_id', o.id, 'label', o.label, 'sort_order', o.sort_order,
        'votes', (SELECT count(*)::int FROM public.poll_votes v WHERE v.option_id = o.id)
      ) ORDER BY o.sort_order)
     FROM public.poll_options o WHERE o.poll_id = p.id) AS options
  FROM public.polls p
  WHERE p.pool_id = p_pool_id AND p.is_active
  ORDER BY p.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. TRIGGER
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS announcement_updated_at ON public.pool_announcements;
CREATE TRIGGER announcement_updated_at
  BEFORE UPDATE ON public.pool_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_announcement_updated_at();


-- ---------------------------------------------------------------------------
-- 5. GRANTS / REVOKES (live privilege state)
-- ---------------------------------------------------------------------------

-- service_role only
REVOKE EXECUTE ON FUNCTION public.set_announcement_pinned(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_announcement_pinned(uuid, uuid, boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_poll(uuid, uuid, text, text[], timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_poll(uuid, uuid, text, text[], timestamp with time zone) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cast_poll_vote(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(uuid, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_poll(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_poll(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_pool_polls(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pool_polls(uuid, uuid) TO service_role;

-- trigger function — no direct EXECUTE for clients
REVOKE EXECUTE ON FUNCTION public.tg_announcement_updated_at() FROM PUBLIC, anon, authenticated;

-- Carryover from after 20260812200000: guard trigger fn shouldn't have direct grants
REVOKE EXECUTE ON FUNCTION public.tg_guard_pool_creator() FROM PUBLIC, anon, authenticated;
