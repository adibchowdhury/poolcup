-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent.
--
-- Prediction Streaks: users.last_seen_streak + get_prediction_streak +
-- award_streak_milestones, plus defense-in-depth EXECUTE revokes.
-- Function bodies dumped from production via pg_get_functiondef (2026-08-12).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. COLUMN
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_seen_streak integer NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. FUNCTIONS (production bodies via pg_get_functiondef)
-- ---------------------------------------------------------------------------

-- Return columns changed in prod — drop old signature before recreate.
DROP FUNCTION IF EXISTS public.get_prediction_streak(uuid);

CREATE OR REPLACE FUNCTION public.get_prediction_streak(p_user_id uuid)
 RETURNS TABLE(current_streak integer, longest_streak integer, last_predicted_day date, today_is_eligible boolean, today_is_open boolean, today_predicted boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH today AS (SELECT (now() AT TIME ZONE 'UTC')::date AS d),
  day_status AS (
    SELECT date(m.kickoff_at AT TIME ZONE 'UTC') AS d,
           bool_and(m.kickoff_at <= now()) AS all_locked
    FROM public.matches m
    GROUP BY date(m.kickoff_at AT TIME ZONE 'UTC')
  ),
  eligible_closed AS (
    SELECT d FROM day_status WHERE all_locked AND d <= (SELECT d FROM today)
  ),
  user_days AS (
    SELECT DISTINCT date(pr.submitted_at AT TIME ZONE 'UTC') AS d
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    WHERE pm.user_id = p_user_id
  ),
  seq AS (
    SELECT ed.d, (ud.d IS NOT NULL) AS predicted, row_number() OVER (ORDER BY ed.d) AS rn
    FROM eligible_closed ed LEFT JOIN user_days ud ON ud.d = ed.d
  ),
  islands AS (
    SELECT d, predicted, rn, rn - sum(CASE WHEN predicted THEN 1 ELSE 0 END) OVER (ORDER BY rn) AS grp
    FROM seq
  ),
  runs AS (SELECT grp, count(*) AS run_len, max(d) AS run_end FROM islands WHERE predicted GROUP BY grp),
  longest AS (SELECT COALESCE(max(run_len),0)::int AS v FROM runs),
  most_recent_closed AS (SELECT max(d) AS d FROM eligible_closed),
  current_run AS (
    SELECT COALESCE((SELECT r.run_len FROM runs r WHERE r.run_end = (SELECT d FROM most_recent_closed)),0)::int AS v
  )
  SELECT
    (SELECT v FROM current_run),
    (SELECT v FROM longest),
    (SELECT max(d) FROM user_days),
    EXISTS (SELECT 1 FROM day_status WHERE d = (SELECT d FROM today)),
    EXISTS (SELECT 1 FROM day_status WHERE d = (SELECT d FROM today) AND NOT all_locked),
    EXISTS (SELECT 1 FROM user_days WHERE d = (SELECT d FROM today));
$function$;

CREATE OR REPLACE FUNCTION public.award_streak_milestones(p_user_id uuid, p_current_streak integer)
 RETURNS TABLE(milestone integer, xp_awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_milestones int[] := ARRAY[3,7,14,30];
  v_xp int[] := ARRAY[15,25,40,75];   -- XP per milestone (3d=15, 7d=25, 14d=40, 30d=75)
  i int;
  v_awarded int;
BEGIN
  FOR i IN 1..array_length(v_milestones,1) LOOP
    IF p_current_streak >= v_milestones[i] THEN
      v_awarded := public.award_xp(
        p_user_id, v_xp[i], 'streak_milestone', 'streak_'||v_milestones[i]::text,
        v_milestones[i]::text || '-day prediction streak');
      IF v_awarded > 0 THEN
        milestone := v_milestones[i];
        xp_awarded := v_awarded;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. GRANTS / REVOKES (live privilege state)
-- ---------------------------------------------------------------------------

-- get_prediction_streak: read-only; website route is self-scoped.
GRANT EXECUTE ON FUNCTION public.get_prediction_streak(uuid)
  TO authenticated, service_role;

-- award_streak_milestones: awards XP → service_role ONLY.
REVOKE EXECUTE ON FUNCTION public.award_streak_milestones(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_streak_milestones(uuid, integer)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Defense-in-depth: revoke stray PUBLIC execute on admin/cron helpers
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_award_badge(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_badge(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_standings_snapshots()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_match_crowd_picks()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_official_pools()
  FROM PUBLIC, anon, authenticated;
