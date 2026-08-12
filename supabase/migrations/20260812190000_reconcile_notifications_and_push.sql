-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent.
--
-- Notification Center + Web Push objects (tables, RPCs, triggers, grants).
-- Function bodies dumped from production via pg_get_functiondef (2026-08-12).
-- Objects: 3 tables (+ indexes/RLS/policies), 10 functions, 2 triggers, grants/revokes.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. TABLES (+ indexes + RLS + policies)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_read_own ON public.notifications;
CREATE POLICY notifications_read_own
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_prefs_own ON public.notification_preferences;
CREATE POLICY notif_prefs_own
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subs_own ON public.push_subscriptions;
CREATE POLICY push_subs_own
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 2. FUNCTIONS (verbatim from production pg_get_functiondef)
-- ---------------------------------------------------------------------------

-- create_notification
CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_category text, p_title text, p_body text DEFAULT NULL::text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean;
  v_id uuid;
BEGIN
  -- check preference (default enabled if no row)
  SELECT enabled INTO v_enabled FROM public.notification_preferences
   WHERE user_id = p_user_id AND category = p_category;
  IF v_enabled IS NOT NULL AND NOT v_enabled THEN
    RETURN NULL;  -- user disabled this category
  END IF;

  INSERT INTO public.notifications (user_id, category, title, body, data)
  VALUES (p_user_id, p_category, p_title, p_body, COALESCE(p_data,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$

-- get_unread_notification_count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int FROM public.notifications WHERE user_id = auth.uid() AND read_at IS NULL;
$function$

-- get_notifications
CREATE OR REPLACE FUNCTION public.get_notifications(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, category text, title text, body text, data jsonb, read_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, category, title, body, data, read_at, created_at
  FROM public.notifications WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT greatest(p_limit,1) OFFSET greatest(p_offset,0);
$function$

-- mark_notification_read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.notifications SET read_at = now()
  WHERE id = p_id AND user_id = auth.uid() AND read_at IS NULL;
$function$

-- mark_all_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  UPDATE public.notifications SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$

-- notify_leaderboard_movement
CREATE OR REPLACE FUNCTION public.notify_leaderboard_movement(p_pool_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; v_count integer := 0; v_pool_name text;
BEGIN
  SELECT name INTO v_pool_name FROM public.pools WHERE id = p_pool_id;

  FOR r IN
    SELECT pm.user_id, lc.rank, lc.prev_rank
    FROM public.leaderboard_cache lc
    JOIN public.pool_members pm ON pm.id = lc.member_id
    WHERE lc.pool_id = p_pool_id AND lc.prev_rank IS NOT NULL AND lc.rank <> lc.prev_rank
  LOOP
    -- entered top 3
    IF r.rank <= 3 AND r.prev_rank > 3 THEN
      PERFORM public.create_notification(
        r.user_id, 'leaderboard',
        'You moved into the top 3 in ' || COALESCE(v_pool_name,'a pool') || '!',
        'You are now ranked #' || r.rank || '.',
        jsonb_build_object('href','/pool/'||p_pool_id::text,'pool_id',p_pool_id,'rank',r.rank));
      v_count := v_count + 1;
    -- lost first place
    ELSIF r.rank > 1 AND r.prev_rank = 1 THEN
      PERFORM public.create_notification(
        r.user_id, 'leaderboard',
        'You lost first place in ' || COALESCE(v_pool_name,'a pool'),
        'You dropped to #' || r.rank || '. Make your next picks to climb back.',
        jsonb_build_object('href','/pool/'||p_pool_id::text,'pool_id',p_pool_id,'rank',r.rank));
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$function$

-- get_user_push_subscriptions
CREATE OR REPLACE FUNCTION public.get_user_push_subscriptions(p_user_id uuid)
 RETURNS TABLE(id uuid, endpoint text, p256dh text, auth text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id = p_user_id;
$function$

-- delete_push_subscription
CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
$function$

-- tg_notify_badge_earned
CREATE OR REPLACE FUNCTION public.tg_notify_badge_earned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_name text; v_rarity text;
BEGIN
  SELECT name, rarity INTO v_name, v_rarity FROM public.achievements WHERE id = NEW.achievement_id;
  PERFORM public.create_notification(
    NEW.user_id, 'badge',
    'Badge unlocked: ' || COALESCE(v_name, NEW.achievement_id),
    'You earned a new ' || COALESCE(v_rarity,'') || ' badge.',
    jsonb_build_object('href','/achievements','achievement_id',NEW.achievement_id,'rarity',v_rarity)
  );
  RETURN NEW;
END;
$function$

-- tg_notify_friendship
CREATE OR REPLACE FUNCTION public.tg_notify_friendship()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_from_name text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT display_name INTO v_from_name FROM public.users WHERE id = NEW.requester_id;
    PERFORM public.create_notification(
      NEW.addressee_id, 'friend',
      COALESCE(v_from_name,'Someone') || ' sent you a friend request',
      NULL,
      jsonb_build_object('href','/friends','from_user_id',NEW.requester_id)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND COALESCE(OLD.status,'') <> 'accepted' THEN
    SELECT display_name INTO v_from_name FROM public.users WHERE id = NEW.addressee_id;
    PERFORM public.create_notification(
      NEW.requester_id, 'friend',
      COALESCE(v_from_name,'Someone') || ' accepted your friend request',
      NULL,
      jsonb_build_object('href','/friends','from_user_id',NEW.addressee_id)
    );
  END IF;
  RETURN NEW;
END;
$function$


-- ---------------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS notify_badge_earned ON public.user_achievements;
CREATE TRIGGER notify_badge_earned
  AFTER INSERT ON public.user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_badge_earned();

DROP TRIGGER IF EXISTS notify_friendship ON public.friendships;
CREATE TRIGGER notify_friendship
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_friendship();


-- ---------------------------------------------------------------------------
-- 4. GRANTS / REVOKES (live privilege state)
-- ---------------------------------------------------------------------------

-- creation + send helpers: service_role only
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_leaderboard_movement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_leaderboard_movement(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_push_subscriptions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_push_subscriptions(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_push_subscription(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.tg_notify_badge_earned() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_friendship() FROM PUBLIC, anon, authenticated;

-- self-scoped read/mark: authenticated (correct)
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_notifications(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated, service_role;
