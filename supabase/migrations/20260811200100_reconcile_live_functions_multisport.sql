-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
-- =============================================================================
-- RECONCILIATION MIGRATION (part 2): CURRENT LIVE function definitions.
-- Applied live via MCP during the multi-sport + social + leaderboard +
-- observability build-out; committed here so the repo can rebuild the DB.
--
-- SAFETY: CREATE OR REPLACE only. Re-applying is a no-op on live.
-- Function bodies captured VERBATIM from the live database
-- (pg_get_functiondef). All are SECURITY DEFINER with search_path=public.
--
-- Do NOT run this against production — it is already there. This file exists
-- ONLY for repo parity and fresh rebuilds.
-- =============================================================================

-- ---------------------------------------------------------------------
-- get_global_xp_leaderboard_page(p_limit integer, p_offset integer)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_global_xp_leaderboard_page(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar text, custom_avatar_url text, total_xp integer, global_rank integer, total_ranked integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH user_xp AS (
    SELECT ua.user_id, sum(a.xp_value)::int AS xp
    FROM public.user_achievements ua
    JOIN public.achievements a ON a.id = ua.achievement_id
    JOIN public.users u ON u.id = ua.user_id
    WHERE NOT coalesce(u.banned, false)
    GROUP BY ua.user_id
  ),
  ranked AS (
    SELECT ux.user_id, ux.xp,
      rank() OVER (ORDER BY ux.xp DESC, ux.user_id)::int AS global_rank
    FROM user_xp ux
    WHERE ux.xp > 0
  ),
  cnt AS (SELECT count(*)::int AS total FROM ranked)
  SELECT r.user_id, u.display_name, u.username, u.avatar, u.custom_avatar_url,
         r.xp AS total_xp, r.global_rank, (SELECT total FROM cnt) AS total_ranked
  FROM ranked r
  JOIN public.users u ON u.id = r.user_id
  ORDER BY r.global_rank
  LIMIT greatest(p_limit,1) OFFSET greatest(p_offset,0);
$function$;

-- ---------------------------------------------------------------------
-- get_friends_xp_leaderboard()
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friends_xp_leaderboard()
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar text, custom_avatar_url text, total_xp integer, friend_rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH my_friends AS (
    SELECT CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS fid
    FROM public.friendships f
    WHERE f.status='accepted' AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    UNION SELECT auth.uid()   -- include self in the friends board
  ),
  user_xp AS (
    SELECT ua.user_id, sum(a.xp_value)::int AS xp
    FROM public.user_achievements ua
    JOIN public.achievements a ON a.id = ua.achievement_id
    JOIN public.users u ON u.id = ua.user_id
    WHERE ua.user_id IN (SELECT fid FROM my_friends) AND NOT coalesce(u.banned,false)
    GROUP BY ua.user_id
  )
  SELECT ux.user_id, u.display_name, u.username, u.avatar, u.custom_avatar_url,
         ux.xp AS total_xp,
         rank() OVER (ORDER BY ux.xp DESC, ux.user_id)::int AS friend_rank
  FROM user_xp ux JOIN public.users u ON u.id = ux.user_id
  ORDER BY friend_rank;
$function$;

-- ---------------------------------------------------------------------
-- get_user_global_rank(p_user_id uuid)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_global_rank(p_user_id uuid)
 RETURNS TABLE(total_xp integer, global_rank integer, total_ranked integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH user_xp AS (
    SELECT ua.user_id, sum(a.xp_value)::int AS xp
    FROM public.user_achievements ua
    JOIN public.achievements a ON a.id = ua.achievement_id
    JOIN public.users u ON u.id = ua.user_id
    WHERE NOT coalesce(u.banned,false)
    GROUP BY ua.user_id
  ),
  me AS (SELECT COALESCE((SELECT xp FROM user_xp WHERE user_id = p_user_id), 0) AS my_xp)
  SELECT
    (SELECT my_xp FROM me) AS total_xp,
    CASE WHEN (SELECT my_xp FROM me) = 0 THEN NULL
         ELSE (SELECT count(*)::int + 1 FROM user_xp WHERE xp > (SELECT my_xp FROM me)) END AS global_rank,
    (SELECT count(*)::int FROM user_xp WHERE xp > 0) AS total_ranked;
$function$;

-- ---------------------------------------------------------------------
-- get_sync_status()
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sync_status()
 RETURNS TABLE(job_type text, event_id uuid, event_name text, last_success timestamp with time zone, last_status text, last_error text, last_run timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH latest AS (
    SELECT DISTINCT ON (sj.job_type, sj.event_id)
      sj.job_type, sj.event_id, sj.status, sj.error_message, sj.finished_at, sj.created_at
    FROM public.sync_jobs sj
    ORDER BY sj.job_type, sj.event_id, sj.created_at DESC
  ),
  last_ok AS (
    SELECT sj.job_type, sj.event_id, max(sj.finished_at) AS last_success
    FROM public.sync_jobs sj WHERE sj.status='success'
    GROUP BY sj.job_type, sj.event_id
  )
  SELECT l.job_type, l.event_id, se.name,
         lo.last_success, l.status, l.error_message, l.created_at
  FROM latest l
  LEFT JOIN last_ok lo ON lo.job_type = l.job_type AND lo.event_id IS NOT DISTINCT FROM l.event_id
  LEFT JOIN public.sporting_events se ON se.id = l.event_id
  ORDER BY l.job_type, se.name NULLS FIRST;
$function$;

-- ---------------------------------------------------------------------
-- get_trending_official_pools(p_limit integer)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_trending_official_pools(p_limit integer DEFAULT 10)
 RETURNS TABLE(pool_id uuid, name text, invite_code text, scoring_style text, event_id uuid, event_name text, sport text, host_user_id uuid, host_name text, host_avatar text, host_custom_avatar_url text, member_count integer, recent_joins integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH recent AS (
    SELECT pm.pool_id, count(*)::int AS recent_joins
    FROM public.pool_members pm
    WHERE pm.joined_at >= now() - interval '7 days'
    GROUP BY pm.pool_id
  ),
  totals AS (
    SELECT pm.pool_id, count(*)::int AS member_count
    FROM public.pool_members pm GROUP BY pm.pool_id
  )
  SELECT
    p.id, p.name, p.invite_code, p.scoring_style,
    p.event_id, se.name, se.sport,
    p.creator_id, hu.display_name, hu.avatar, hu.custom_avatar_url,
    coalesce(t.member_count, 0),
    coalesce(r.recent_joins, 0)
  FROM public.pools p
  LEFT JOIN public.sporting_events se ON se.id = p.event_id
  LEFT JOIN public.users hu ON hu.id = p.creator_id
  LEFT JOIN recent r ON r.pool_id = p.id
  LEFT JOIN totals t ON t.pool_id = p.id
  WHERE p.is_official = true AND p.is_public = true
  ORDER BY coalesce(r.recent_joins,0) DESC, coalesce(t.member_count,0) DESC, p.name
  LIMIT greatest(p_limit, 1);
$function$;

-- ---------------------------------------------------------------------
-- ensure_official_pools()
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_official_pools()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_system_host uuid := 'd09d34a9-11c0-4cdd-ab7f-d5b9edf4ff72';
  v_event record;
  v_pool_id uuid;
  v_created int := 0;
  v_pool_name text;
BEGIN
  FOR v_event IN
    SELECT se.id, se.name
    FROM public.sporting_events se
    WHERE se.status IN ('live','upcoming')
      AND NOT EXISTS (
        SELECT 1 FROM public.pools p
        WHERE p.event_id = se.id AND p.is_official = true
      )
  LOOP
    -- Build a clean pool name: "Official <Event> Pool"
    v_pool_name := 'Official ' || v_event.name || ' Pool';

    INSERT INTO public.pools (id, name, creator_id, event_id, scoring_style,
                              is_official, is_public, accepting_members, invite_code)
    VALUES (gen_random_uuid(), v_pool_name, v_system_host, v_event.id, 'classic',
            true, true, true, substr(md5(gen_random_uuid()::text), 1, 8))
    RETURNING id INTO v_pool_id;

    -- Add the system host as a member (like other pools have their creator as a member).
    INSERT INTO public.pool_members (id, pool_id, user_id, display_name, joined_at)
    SELECT gen_random_uuid(), v_pool_id, v_system_host, u.display_name, now()
    FROM public.users u WHERE u.id = v_system_host
    ON CONFLICT DO NOTHING;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$function$;

-- ---------------------------------------------------------------------
-- get_match_consensus(p_match_id uuid)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_match_consensus(p_match_id uuid)
 RETURNS TABLE(home_pct numeric, draw_pct numeric, away_pct numeric, total integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH gate AS (
    SELECT (m.locked_at IS NOT NULL AND m.locked_at <= now()) AS revealed
    FROM public.matches m WHERE m.id = p_match_id
  ),
  picks AS (
    SELECT CASE WHEN pred_team1 > pred_team2 THEN 'home'
                WHEN pred_team2 > pred_team1 THEN 'away' ELSE 'draw' END AS outcome
    FROM public.predictions
    WHERE match_id = p_match_id AND pred_team1 IS NOT NULL AND pred_team2 IS NOT NULL
      AND (SELECT revealed FROM gate)
  ),
  agg AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE outcome='home') AS home,
      count(*) FILTER (WHERE outcome='draw') AS draw,
      count(*) FILTER (WHERE outcome='away') AS away
    FROM picks
  )
  SELECT CASE WHEN total>0 THEN round(home*100.0/total,0) ELSE 0 END,
         CASE WHEN total>0 THEN round(draw*100.0/total,0) ELSE 0 END,
         CASE WHEN total>0 THEN round(away*100.0/total,0) ELSE 0 END,
         total::int FROM agg;
$function$;

-- ---------------------------------------------------------------------
-- get_match_common_scores(p_match_id uuid, p_limit integer)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_match_common_scores(p_match_id uuid, p_limit integer DEFAULT 3)
 RETURNS TABLE(score text, cnt integer, pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH gate AS (
    SELECT (m.locked_at IS NOT NULL AND m.locked_at <= now()) AS revealed
    FROM public.matches m WHERE m.id = p_match_id
  ),
  s AS (
    SELECT pred_team1||'-'||pred_team2 AS score FROM public.predictions
    WHERE match_id = p_match_id AND pred_team1 IS NOT NULL AND pred_team2 IS NOT NULL
      AND (SELECT revealed FROM gate)
  ), t AS (SELECT count(*) AS total FROM s)
  SELECT s.score, count(*)::int,
         round(count(*)*100.0/NULLIF((SELECT total FROM t),0),0)
  FROM s GROUP BY s.score ORDER BY count(*) DESC LIMIT greatest(p_limit,1);
$function$;

-- ---------------------------------------------------------------------
-- get_friends_match_predictions(p_match_id uuid)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friends_match_predictions(p_match_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, avatar text, custom_avatar_url text, pred_team1 integer, pred_team2 integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH gate AS (
    SELECT (m.locked_at IS NOT NULL AND m.locked_at <= now()) AS revealed
    FROM public.matches m WHERE m.id = p_match_id
  ),
  my_friends AS (
    SELECT CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS fid
    FROM public.friendships f
    WHERE f.status='accepted' AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
  )
  SELECT DISTINCT u.id, u.display_name, u.avatar, u.custom_avatar_url, pr.pred_team1, pr.pred_team2
  FROM public.predictions pr
  JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.users u ON u.id = pm.user_id
  WHERE pr.match_id = p_match_id AND pm.user_id IN (SELECT fid FROM my_friends)
    AND (SELECT revealed FROM gate);   -- post-lock only
$function$;

-- ---------------------------------------------------------------------
-- resolve_username(p_username text)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_username(p_username text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.users WHERE lower(username) = lower(trim(p_username)) LIMIT 1;
$function$;

-- ---------------------------------------------------------------------
-- report_user(p_reported_user_id uuid, p_reason text, p_context text)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_user(p_reported_user_id uuid, p_reason text DEFAULT NULL::text, p_context text DEFAULT 'profile'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF auth.uid() = p_reported_user_id THEN RAISE EXCEPTION 'cannot_report_self'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_reports
             WHERE reporter_id = auth.uid() AND reported_user_id = p_reported_user_id
               AND created_at > now() - interval '1 day') THEN
    RETURN 'already_reported';
  END IF;
  INSERT INTO public.user_reports (reporter_id, reported_user_id, reason, context)
  VALUES (auth.uid(), p_reported_user_id, p_reason, p_context);
  RETURN 'reported';
END;
$function$;

-- ---------------------------------------------------------------------
-- get_public_profile(p_user_id uuid)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
 RETURNS TABLE(id uuid, display_name text, username text, avatar text, custom_avatar_url text, is_supporter boolean, created_at timestamp with time zone, total_xp integer, badges_earned integer, predictions_made integer, accuracy numeric, favorite_sports text[], friends_count integer, points integer, exact_scores integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    u.id, u.display_name, u.username, u.avatar, u.custom_avatar_url,
    COALESCE(u.is_supporter, false),
    u.created_at,
    COALESCE((SELECT sum(a.xp_value)::int FROM public.user_achievements ua
              JOIN public.achievements a ON a.id = ua.achievement_id WHERE ua.user_id = u.id), 0),
    COALESCE((SELECT count(*)::int FROM public.user_achievements ua WHERE ua.user_id = u.id), 0),
    COALESCE((SELECT count(*)::int FROM public.predictions pr
              JOIN public.pool_members pm ON pm.id = pr.member_id WHERE pm.user_id = u.id), 0),
    (SELECT CASE WHEN count(*) = 0 THEN NULL
        ELSE round(100.0 * count(*) FILTER (WHERE pr.points_awarded > 0) / count(*)) END
     FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id WHERE pm.user_id = u.id),
    u.favorite_sports,
    COALESCE((SELECT count(*)::int FROM public.friendships f
              WHERE f.status='accepted' AND (f.requester_id = u.id OR f.addressee_id = u.id)), 0),
    COALESCE(u.points, 0),
    COALESCE((SELECT count(*)::int FROM public.predictions pr
              JOIN public.pool_members pm ON pm.id = pr.member_id
              JOIN public.matches m ON m.id = pr.match_id
              WHERE pm.user_id = u.id AND m.is_final = true
                AND pr.pred_team1 = m.result_team1 AND pr.pred_team2 = m.result_team2), 0)
  FROM public.users u
  WHERE u.id = p_user_id AND NOT COALESCE(u.banned, false);
$function$;

-- ---------------------------------------------------------------------
-- get_public_profile_sport_stats(p_user_id uuid)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile_sport_stats(p_user_id uuid)
 RETURNS TABLE(sport text, predictions integer, correct integer, exact integer, points integer, accuracy numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(se.sport,'unknown'), count(*)::int,
    count(*) FILTER (WHERE pr.points_awarded > 0)::int,
    count(*) FILTER (WHERE m.result_team1 = pr.pred_team1 AND m.result_team2 = pr.pred_team2)::int,
    coalesce(sum(pr.points_awarded),0)::int,
    CASE WHEN count(*)=0 THEN NULL ELSE round(100.0*count(*) FILTER (WHERE pr.points_awarded>0)/count(*)) END
  FROM public.predictions pr
  JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.matches m ON m.id = pr.match_id
  LEFT JOIN public.sporting_events se ON se.id = m.event_id
  WHERE pm.user_id = p_user_id AND m.is_final = true
  GROUP BY coalesce(se.sport,'unknown') ORDER BY count(*) DESC;
$function$;

-- ---------------------------------------------------------------------
-- get_public_profile_competition_stats(p_user_id uuid)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile_competition_stats(p_user_id uuid)
 RETURNS TABLE(event_id uuid, event_name text, sport text, predictions integer, correct integer, points integer, accuracy numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.event_id, se.name, se.sport, count(*)::int,
    count(*) FILTER (WHERE pr.points_awarded > 0)::int,
    coalesce(sum(pr.points_awarded),0)::int,
    CASE WHEN count(*)=0 THEN NULL ELSE round(100.0*count(*) FILTER (WHERE pr.points_awarded>0)/count(*)) END
  FROM public.predictions pr
  JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.matches m ON m.id = pr.match_id
  LEFT JOIN public.sporting_events se ON se.id = m.event_id
  WHERE pm.user_id = p_user_id AND m.is_final = true
  GROUP BY m.event_id, se.name, se.sport ORDER BY count(*) DESC;
$function$;

-- ---------------------------------------------------------------------
-- get_public_profile_activity(p_user_id uuid, p_limit integer)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile_activity(p_user_id uuid, p_limit integer DEFAULT 10)
 RETURNS TABLE(match_id uuid, kickoff_at timestamp with time zone, team1_name text, team2_name text, result_team1 integer, result_team2 integer, pred_team1 integer, pred_team2 integer, points_awarded integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (m.id)
    m.id, m.kickoff_at, m.team1_name, m.team2_name,
    m.result_team1, m.result_team2, pr.pred_team1, pr.pred_team2, pr.points_awarded
  FROM public.predictions pr
  JOIN public.pool_members pm ON pm.id = pr.member_id
  JOIN public.matches m ON m.id = pr.match_id
  WHERE pm.user_id = p_user_id
    AND m.locked_at IS NOT NULL AND m.locked_at <= now()
  ORDER BY m.id, m.kickoff_at DESC LIMIT greatest(p_limit,1);
$function$;

-- ---------------------------------------------------------------------
-- mute_user(p_target uuid, p_mute boolean)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mute_user(p_target uuid, p_mute boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = p_target THEN RAISE EXCEPTION 'invalid'; END IF;
  IF p_mute THEN
    INSERT INTO public.user_mutes(user_id, muted_user_id) VALUES (auth.uid(), p_target) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_mutes WHERE user_id = auth.uid() AND muted_user_id = p_target;
  END IF;
END; $function$;

-- ---------------------------------------------------------------------
-- block_user(p_target uuid, p_block boolean)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(p_target uuid, p_block boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = p_target THEN RAISE EXCEPTION 'invalid'; END IF;
  IF p_block THEN
    INSERT INTO public.user_blocks(user_id, blocked_user_id) VALUES (auth.uid(), p_target) ON CONFLICT DO NOTHING;
    -- remove friendship both directions
    DELETE FROM public.friendships
    WHERE (requester_id = auth.uid() AND addressee_id = p_target)
       OR (requester_id = p_target AND addressee_id = auth.uid());
  ELSE
    DELETE FROM public.user_blocks WHERE user_id = auth.uid() AND blocked_user_id = p_target;
  END IF;
END; $function$;

-- ---------------------------------------------------------------------
-- get_friend_suggestions(p_limit integer)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friend_suggestions(p_limit integer DEFAULT 10)
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar text, custom_avatar_url text, shared_pools integer, shared_sports integer, reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  my_pools AS (SELECT pool_id FROM public.pool_members WHERE user_id = (SELECT uid FROM me)),
  my_sports AS (SELECT unnest(coalesce(favorite_sports,'{}')) AS sport FROM public.users WHERE id = (SELECT uid FROM me)),
  excluded AS (
    SELECT (SELECT uid FROM me) AS x
    UNION SELECT CASE WHEN requester_id=(SELECT uid FROM me) THEN addressee_id ELSE requester_id END
      FROM public.friendships
      WHERE requester_id=(SELECT uid FROM me) OR addressee_id=(SELECT uid FROM me)
    UNION SELECT blocked_user_id FROM public.user_blocks WHERE user_id=(SELECT uid FROM me)
    UNION SELECT user_id FROM public.user_blocks WHERE blocked_user_id=(SELECT uid FROM me)
  ),
  pool_overlap AS (
    SELECT pm.user_id, count(DISTINCT pm.pool_id)::int AS shared_pools
    FROM public.pool_members pm
    WHERE pm.pool_id IN (SELECT pool_id FROM my_pools)
      AND pm.user_id NOT IN (SELECT x FROM excluded)
    GROUP BY pm.user_id
  ),
  sport_overlap AS (
    SELECT u.id AS user_id, count(*)::int AS shared_sports
    FROM public.users u, my_sports ms
    WHERE u.favorite_sports IS NOT NULL AND ms.sport = ANY(u.favorite_sports)
      AND u.id NOT IN (SELECT x FROM excluded)
    GROUP BY u.id
  ),
  merged AS (
    SELECT coalesce(po.user_id, so.user_id) AS uid,
           coalesce(po.shared_pools,0) AS sp, coalesce(so.shared_sports,0) AS ss
    FROM pool_overlap po FULL OUTER JOIN sport_overlap so ON po.user_id = so.user_id
  )
  SELECT m.uid, u.display_name, u.username, u.avatar, u.custom_avatar_url,
         m.sp, m.ss,
         CASE WHEN m.sp>0 AND m.ss>0 THEN 'Shared pools & sports'
              WHEN m.sp>0 THEN 'In pools with you'
              ELSE 'Likes the same sports' END
  FROM merged m JOIN public.users u ON u.id = m.uid
  WHERE NOT coalesce(u.banned,false)
  ORDER BY (m.sp*2 + m.ss) DESC, u.display_name
  LIMIT greatest(p_limit,1);
$function$;

-- ---------------------------------------------------------------------
-- get_mutual_friends_count(p_other uuid)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mutual_friends_count(p_other uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH my_friends AS (
    SELECT CASE WHEN requester_id=auth.uid() THEN addressee_id ELSE requester_id END AS fid
    FROM public.friendships WHERE status='accepted' AND (requester_id=auth.uid() OR addressee_id=auth.uid())
  ),
  their_friends AS (
    SELECT CASE WHEN requester_id=p_other THEN addressee_id ELSE requester_id END AS fid
    FROM public.friendships WHERE status='accepted' AND (requester_id=p_other OR addressee_id=p_other)
  )
  SELECT count(*)::int FROM my_friends m JOIN their_friends t ON t.fid = m.fid;
$function$;

-- ---------------------------------------------------------------------
-- get_friend_activity_feed(p_limit integer, p_offset integer)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friend_activity_feed(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(activity_type text, actor_id uuid, actor_name text, actor_username text, actor_avatar text, actor_custom_avatar_url text, occurred_at timestamp with time zone, title text, detail text, ref_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  friends AS (
    SELECT CASE WHEN requester_id=(SELECT uid FROM me) THEN addressee_id ELSE requester_id END AS fid
    FROM public.friendships
    WHERE status='accepted' AND ((SELECT uid FROM me) IN (requester_id, addressee_id))
  ),
  visible_friends AS (
    SELECT fid FROM friends
    WHERE fid NOT IN (SELECT muted_user_id FROM public.user_mutes WHERE user_id=(SELECT uid FROM me))
      AND fid NOT IN (SELECT blocked_user_id FROM public.user_blocks WHERE user_id=(SELECT uid FROM me))
      AND fid NOT IN (SELECT user_id FROM public.user_blocks WHERE blocked_user_id=(SELECT uid FROM me))
  ),
  unioned AS (
    SELECT 'badge'::text AS activity_type, ua.user_id AS actor_id, ua.earned_at AS occurred_at,
           'Earned a badge'::text AS title, a.name::text AS detail, a.id::text AS ref_id
    FROM public.user_achievements ua
    JOIN public.achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id IN (SELECT fid FROM visible_friends)
    UNION ALL
    SELECT 'pool_join'::text, pm.user_id, pm.joined_at,
           'Joined a pool'::text, p.name::text, p.id::text
    FROM public.pool_members pm JOIN public.pools p ON p.id = pm.pool_id
    WHERE pm.user_id IN (SELECT fid FROM visible_friends)
    UNION ALL
    SELECT 'prediction_result'::text, pm.user_id, m.kickoff_at,
           (CASE WHEN pr.points_awarded > 0 THEN 'Scored points' ELSE 'Made a pick' END)::text,
           (m.team1_name || ' ' || m.result_team1 || '-' || m.result_team2 || ' ' || m.team2_name
             || ' (+' || coalesce(pr.points_awarded,0) || ')')::text,
           m.id::text
    FROM public.predictions pr
    JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id
    WHERE pm.user_id IN (SELECT fid FROM visible_friends)
      AND m.is_final = true AND m.locked_at IS NOT NULL AND m.locked_at <= now()
  )
  SELECT u2.activity_type, u.id, u.display_name, u.username, u.avatar, u.custom_avatar_url,
         u2.occurred_at, u2.title, u2.detail, u2.ref_id
  FROM unioned u2 JOIN public.users u ON u.id = u2.actor_id
  WHERE NOT coalesce(u.banned,false)
  ORDER BY u2.occurred_at DESC NULLS LAST
  LIMIT greatest(p_limit,1) OFFSET greatest(p_offset,0);
$function$;

-- ---------------------------------------------------------------------
-- search_users(p_query text, p_limit integer)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_users(p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar text, custom_avatar_url text, friendship_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid)
  SELECT
    u.id, u.display_name, u.username, u.avatar, u.custom_avatar_url,
    COALESCE((
      SELECT CASE
        WHEN f.status = 'accepted' THEN 'friends'
        WHEN f.requester_id = (SELECT uid FROM me) THEN 'request_sent'
        ELSE 'request_received'
      END
      FROM public.friendships f
      WHERE (f.requester_id = (SELECT uid FROM me) AND f.addressee_id = u.id)
         OR (f.requester_id = u.id AND f.addressee_id = (SELECT uid FROM me))
      LIMIT 1
    ), 'none') AS friendship_status
  FROM public.users u
  WHERE u.id <> (SELECT uid FROM me)
    AND length(trim(p_query)) >= 2
    AND NOT COALESCE(u.banned, false)
    -- match display name OR username
    AND (u.display_name ILIKE '%' || trim(p_query) || '%'
         OR u.username ILIKE '%' || trim(p_query) || '%')
    -- exclude users blocked by me or who blocked me
    AND u.id NOT IN (SELECT blocked_user_id FROM public.user_blocks WHERE user_id = (SELECT uid FROM me))
    AND u.id NOT IN (SELECT user_id FROM public.user_blocks WHERE blocked_user_id = (SELECT uid FROM me))
  ORDER BY
    CASE WHEN u.display_name ILIKE trim(p_query) || '%'
           OR u.username ILIKE trim(p_query) || '%' THEN 0 ELSE 1 END,
    u.display_name
  LIMIT GREATEST(LEAST(p_limit, 50), 1);
$function$;

-- =============================================================================
-- GRANTs (recorded for rebuild parity)
--   authenticated + service_role on all 21 functions
--   anon additionally on public-read helpers listed below
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_global_xp_leaderboard_page(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_friends_xp_leaderboard() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_global_rank(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sync_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_trending_official_pools(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_official_pools() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_match_consensus(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_match_common_scores(uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_friends_match_predictions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_username(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profile_sport_stats(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profile_competition_stats(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profile_activity(uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mute_user(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.block_user(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_friend_suggestions(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mutual_friends_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_friend_activity_feed(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_users(text, integer) TO authenticated, service_role;

-- =============================================================================
-- END reconciliation part 2 (multisport / social / leaderboard).
-- =============================================================================
