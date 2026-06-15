-- ============================================================
-- PoolCup — Database Schema Backup (2 of 2): FUNCTIONS, RLS POLICIES, TRIGGERS
-- Snapshot of the live database (public schema) — 2026-06-12
-- Project: pyydeixbkzzyezjuqted
--
-- Apply this file AFTER 01_tables.sql (policies and triggers depend on the
-- tables and functions defined here / there).
-- Order within this file: functions -> enable RLS -> policies -> triggers.
--
-- Not captured here (limitations of a hand-built snapshot vs pg_dump):
--   * GRANT/REVOKE privileges on functions (e.g. the EXECUTE revokes that lock
--     down the scoring functions) and table-level grants.
--   * Extensions, auth/storage schema objects, and row DATA.
-- These don't affect the structure/logic below, but note them if doing a full
-- cold rebuild.
-- ============================================================


-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.actual_group_order(p_group text)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_total int;
  v_final int;
  v_order text[];
begin
  select count(*), count(*) filter (where is_final)
    into v_total, v_final
  from public.matches
  where trim(group_name) = p_group and round = 'group';

  if v_total = 0 or v_final < v_total then
    return null;
  end if;

  with team_results as (
    select team1_name as team, result_team1 as gf, result_team2 as ga
    from public.matches where trim(group_name) = p_group and round = 'group' and is_final
    union all
    select team2_name, result_team2, result_team1
    from public.matches where trim(group_name) = p_group and round = 'group' and is_final
  ),
  standings as (
    select team,
           sum(case when gf > ga then 3 when gf = ga then 1 else 0 end) as pts,
           sum(gf - ga) as gd,
           sum(gf) as gf
    from team_results group by team
  )
  select array_agg(team order by pts desc, gd desc, gf desc, team asc)
    into v_order from standings;

  return v_order;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.actual_third_place_qualifiers()
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_groups_total int;
  v_groups_done int;
  v_result text[];
begin
  select count(distinct trim(group_name)) into v_groups_total
  from public.matches where round = 'group';

  select count(*) into v_groups_done from (
    select trim(group_name) g
    from public.matches where round = 'group'
    group by trim(group_name)
    having count(*) = count(*) filter (where is_final)
  ) x;

  if v_groups_total = 0 or v_groups_done < v_groups_total then
    return null;
  end if;

  with team_results as (
    select trim(group_name) as grp, team1_name as team, result_team1 as gf, result_team2 as ga
    from public.matches where round = 'group' and is_final
    union all
    select trim(group_name), team2_name, result_team2, result_team1
    from public.matches where round = 'group' and is_final
  ),
  standings as (
    select grp, team,
           sum(case when gf > ga then 3 when gf = ga then 1 else 0 end) as pts,
           sum(gf - ga) as gd, sum(gf) as gf
    from team_results group by grp, team
  ),
  ranked as (
    select grp, team, pts, gd, gf,
           row_number() over (partition by grp order by pts desc, gd desc, gf desc, team asc) as pos
    from standings
  )
  select array_agg(team order by pts desc, gd desc, gf desc, team asc)
    into v_result
  from (
    select team, pts, gd, gf from ranked where pos = 3
    order by pts desc, gd desc, gf desc, team asc
    limit 8
  ) t;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.award_pool_created_points(p_pool_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_creator_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select creator_id into v_creator_id
  from public.pools
  where id = p_pool_id;

  if v_creator_id is null then
    raise exception 'Pool not found';
  end if;

  if v_creator_id <> v_user_id then
    raise exception 'Forbidden';
  end if;

  update public.users
  set points = points + 5
  where id = v_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.award_pool_creation_points(p_pool_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_creator_id uuid := auth.uid();
begin
  if v_creator_id is null then
    raise exception 'Not authenticated';
  end if;
  update public.users
  set points = points + 5
  where id = v_creator_id;
  insert into public.points_transactions (user_id, points, reason, created_at)
  values (v_creator_id, 5, 'pool_created', now());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.award_referral_points(p_pool_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_creator_id uuid;
  v_joiner_id uuid := auth.uid();
begin
  if v_joiner_id is null then
    raise exception 'Not authenticated';
  end if;
  select creator_id into v_creator_id
  from public.pools
  where id = p_pool_id;
  if v_creator_id is null then
    raise exception 'Pool not found';
  end if;
  if v_creator_id = v_joiner_id then
    return;
  end if;
  if not exists (
    select 1 from public.pool_members
    where pool_id = p_pool_id and user_id = v_joiner_id
  ) then
    raise exception 'Joiner is not a pool member';
  end if;
  update public.users
  set points = points + 30
  where id = v_creator_id;
  insert into public.points_transactions (user_id, points, reason)
  values (v_creator_id, 30, 'referral');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_match_points(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_match record;
  v_prediction record;
  v_points int;
  v_old_points int;
  v_delta int;
  v_multiplier int;
  v_reason text;
begin
  select * into v_match from public.matches where id = p_match_id;

  if v_match.result_team1 is null or v_match.result_team2 is null then
    return;
  end if;

  -- Only score a finished match. Live updates just refresh the displayed score.
  if not coalesce(v_match.is_final, false) then
    return;
  end if;

  v_multiplier := case v_match.round
    when 'r32'   then 1
    when 'r16'   then 2
    when 'qf'    then 3
    when 'sf'    then 4
    when 'final' then 5
    else 1
  end;

  for v_prediction in
    select p.*, pl.scoring_style, pm.user_id as predictor_user_id
    from public.predictions p
    join public.pools pl on pl.id = p.pool_id
    join public.pool_members pm on pm.id = p.member_id
    where p.match_id = p_match_id
  loop
    v_points := 0;
    v_old_points := coalesce(v_prediction.points_awarded, 0);

    if v_prediction.scoring_style = 'winner' then
      if (v_prediction.pred_team1 > v_prediction.pred_team2
          and v_match.result_team1 > v_match.result_team2)
      or (v_prediction.pred_team1 < v_prediction.pred_team2
          and v_match.result_team1 < v_match.result_team2)
      or (v_prediction.pred_team1 = v_prediction.pred_team2
          and v_match.result_team1 = v_match.result_team2) then
        v_points := 2;
      end if;
    else
      if v_prediction.pred_team1 = v_match.result_team1
         and v_prediction.pred_team2 = v_match.result_team2 then
        v_points := 5;
      elsif (v_prediction.pred_team1 > v_prediction.pred_team2
             and v_match.result_team1 > v_match.result_team2)
         or (v_prediction.pred_team1 < v_prediction.pred_team2
             and v_match.result_team1 < v_match.result_team2)
         or (v_prediction.pred_team1 = v_prediction.pred_team2
             and v_match.result_team1 = v_match.result_team2) then
        v_points := 2;
      end if;
    end if;

    v_points := v_points * v_multiplier;
    v_delta := v_points - v_old_points;

    update public.predictions
    set points_awarded = v_points
    where id = v_prediction.id;

    if v_delta <> 0 then
      update public.users
      set points = points + v_delta
      where id = v_prediction.predictor_user_id;

      v_reason := case
        when v_prediction.pred_team1 = v_match.result_team1
         and v_prediction.pred_team2 = v_match.result_team2 then 'exact_score'
        else 'correct_winner'
      end;

      insert into public.points_transactions (user_id, points, reason, created_at)
      values (v_prediction.predictor_user_id, v_delta, v_reason, now());
    end if;
  end loop;

  insert into public.leaderboard_cache
    (pool_id, member_id, total_points, correct_winners, exact_scores, rank, prev_rank, updated_at)
  select
    p.pool_id,
    p.member_id,
    coalesce(sum(p.points_awarded), 0) as total_points,
    count(*) filter (where p.points_awarded >= 2) as correct_winners,
    count(*) filter (where p.points_awarded = 5) as exact_scores,
    rank() over (
      partition by p.pool_id
      order by coalesce(sum(p.points_awarded), 0) desc
    ) as rank,
    coalesce(
      (select lc.rank from public.leaderboard_cache lc
       where lc.pool_id = p.pool_id and lc.member_id = p.member_id),
      0
    ) as prev_rank,
    now()
  from public.predictions p
  where p.pool_id in (
    select distinct pool_id from public.predictions where match_id = p_match_id
  )
  group by p.pool_id, p.member_id
  on conflict (pool_id, member_id) do update set
    prev_rank = leaderboard_cache.rank,
    total_points = excluded.total_points,
    correct_winners = excluded.correct_winners,
    exact_scores = excluded.exact_scores,
    rank = excluded.rank,
    updated_at = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_current_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- events has no FK cascade, so clear them explicitly
  delete from public.events
   where user_id = uid
      or pool_id in (select id from public.pools where creator_id = uid);

  -- deleting the auth user cascades to public.users, their pools and all child
  -- rows, memberships, points, third-place rankings, and auth sub-tables
  delete from auth.users where id = uid;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.group_locked(p_group_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select now() >= coalesce(
    (select min(m.kickoff_at)
       from public.matches m
      where m.group_name = trim(p_group_name)),
    'infinity'::timestamptz
  );
$function$
;

CREATE OR REPLACE FUNCTION public.group_stage_locked()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$ select now() >= timestamptz '2026-06-11T19:00:00Z' $function$
;

CREATE OR REPLACE FUNCTION public.handle_issue_report_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_secret text;
begin
  select value into v_secret from private.app_secrets where key = 'bug_webhook_secret';
  perform net.http_post(
    url := 'https://pyydeixbkzzyezjuqted.supabase.co/functions/v1/send-bug-ack',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'issue_reports',
      'schema', 'public',
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.users (id, email, display_name, points)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(trim(
        coalesce(new.raw_user_meta_data->>'first_name','') || ' ' ||
        coalesce(new.raw_user_meta_data->>'last_name','')
      ), '')
    ),
    50
  )
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, public.users.display_name),
      email = coalesce(excluded.email, public.users.email);

  insert into public.points_transactions (user_id, points, reason)
  values (new.id, 50, 'signup')
  on conflict do nothing;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.on_match_final_score_winners()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_group text;
  v_total int;
  v_final int;
  v_groups_total int;
  v_groups_done int;
begin
  if coalesce(NEW.is_final, false)
     and NEW.is_final is distinct from coalesce(OLD.is_final, false) then

    v_group := trim(NEW.group_name);

    select count(*), count(*) filter (where is_final)
      into v_total, v_final
    from public.matches
    where trim(group_name) = v_group and round = 'group';

    if v_total > 0 and v_final = v_total then
      begin
        perform public.score_winner_group(v_group);
      exception when others then
        null;  -- never break the score sync
      end;

      select count(distinct trim(group_name)) into v_groups_total
      from public.matches where round = 'group';

      select count(*) into v_groups_done from (
        select trim(group_name) g
        from public.matches where round = 'group'
        group by trim(group_name)
        having count(*) = count(*) filter (where is_final)
      ) x;

      if v_groups_done = v_groups_total then
        begin
          perform public.score_third_place();
        exception when others then
          null;
        end;
      end if;
    end if;
  end if;

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rebuild_all_winner_leaderboards()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.leaderboard_cache
    (pool_id, member_id, total_points, correct_winners, exact_scores, rank, prev_rank, updated_at)
  select
    pm.pool_id,
    pm.id,
    coalesce(g.grp_pts, 0) + coalesce(tp.tp_pts, 0) as total_points,
    0, 0,
    rank() over (
      partition by pm.pool_id
      order by coalesce(g.grp_pts, 0) + coalesce(tp.tp_pts, 0) desc
    ),
    coalesce((select lc.rank from public.leaderboard_cache lc
              where lc.pool_id = pm.pool_id and lc.member_id = pm.id), 0),
    now()
  from public.pool_members pm
  join public.pools p on p.id = pm.pool_id and p.scoring_style = 'winner'
  left join (
    select member_id, sum(coalesce(points_awarded, 0)) as grp_pts
    from public.group_predictions group by member_id
  ) g on g.member_id = pm.id
  left join (
    select pool_id, user_id, sum(coalesce(points_awarded, 0)) as tp_pts
    from public.third_place_rankings group by pool_id, user_id
  ) tp on tp.pool_id = pm.pool_id and tp.user_id = pm.user_id
  on conflict (pool_id, member_id) do update set
    prev_rank = public.leaderboard_cache.rank,
    total_points = excluded.total_points,
    correct_winners = 0,
    exact_scores = 0,
    rank = excluded.rank,
    updated_at = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.score_third_place()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qual text[];
  v_row record;
  v_predarr text[];
  v_count int;
  v_points int;
  v_old int;
  v_delta int;
  i int;
begin
  v_qual := public.actual_third_place_qualifiers();
  if v_qual is null then
    return;
  end if;

  for v_row in
    select tpr.id, tpr.rankings, tpr.user_id
    from public.third_place_rankings tpr
    join public.pools pl on pl.id = tpr.pool_id and pl.scoring_style = 'winner'
  loop
    select array_agg(elem order by ord) into v_predarr
    from jsonb_array_elements_text(v_row.rankings) with ordinality as t(elem, ord);

    v_count := 0;
    for i in 1 .. least(coalesce(array_length(v_predarr, 1), 0), 8) loop
      if v_predarr[i] = any(v_qual) then
        v_count := v_count + 1;
      end if;
    end loop;
    v_points := v_count * 2;

    v_old := coalesce((select points_awarded from public.third_place_rankings where id = v_row.id), 0);
    v_delta := v_points - v_old;

    update public.third_place_rankings set points_awarded = v_points where id = v_row.id;

    if v_delta <> 0 then
      update public.users set points = points + v_delta where id = v_row.user_id;
      insert into public.points_transactions (user_id, points, reason, created_at)
      values (v_row.user_id, v_delta, 'third_place', now());
    end if;
  end loop;

  perform public.rebuild_all_winner_leaderboards();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.score_winner_group(p_group text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actual text[];
  v_pred record;
  v_predarr text[];
  v_points int;
  v_old int;
  v_delta int;
  i int;
begin
  v_actual := public.actual_group_order(p_group);
  if v_actual is null then
    return;
  end if;

  for v_pred in
    select gp.id, gp.standings, pm.user_id
    from public.group_predictions gp
    join public.pool_members pm on pm.id = gp.member_id
    join public.pools pl on pl.id = gp.pool_id and pl.scoring_style = 'winner'
    where trim(gp.group_name) = p_group
  loop
    select array_agg(elem order by ord) into v_predarr
    from jsonb_array_elements_text(v_pred.standings) with ordinality as t(elem, ord);

    v_points := 0;

    -- correct group winner
    if array_length(v_predarr, 1) >= 1 and v_predarr[1] = v_actual[1] then
      v_points := v_points + 5;
    end if;

    -- both qualifiers correct (top 2 in any order)
    if array_length(v_predarr, 1) >= 2
       and v_predarr[1] <> v_predarr[2]
       and v_predarr[1] in (v_actual[1], v_actual[2])
       and v_predarr[2] in (v_actual[1], v_actual[2]) then
      v_points := v_points + 3;
    end if;

    -- each team in its exact finishing position
    for i in 1 .. least(coalesce(array_length(v_predarr, 1), 0), 4) loop
      if v_predarr[i] = v_actual[i] then
        v_points := v_points + 2;
      end if;
    end loop;

    v_old := coalesce((select points_awarded from public.group_predictions where id = v_pred.id), 0);
    v_delta := v_points - v_old;

    update public.group_predictions set points_awarded = v_points where id = v_pred.id;

    if v_delta <> 0 then
      update public.users set points = points + v_delta where id = v_pred.user_id;
      insert into public.points_transactions (user_id, points, reason, created_at)
      values (v_pred.user_id, v_delta, 'winner_group', now());
    end if;
  end loop;

  perform public.rebuild_all_winner_leaderboards();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_pool_member_display_names()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if NEW.display_name is distinct from OLD.display_name then
    update public.pool_members
    set display_name = NEW.display_name
    where user_id = NEW.id
      and display_name is distinct from NEW.display_name;
  end if;
  return NEW;
end;
$function$
;


-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_member_name_backup_20260611 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.third_place_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================

CREATE POLICY events_insert_anon_auth ON public.events AS PERMISSIVE FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Lock group_predictions deletes after group kickoff" ON public.group_predictions AS RESTRICTIVE FOR DELETE TO public
  USING ((NOT group_locked((group_name)::text)));

CREATE POLICY "Lock group_predictions inserts after group kickoff" ON public.group_predictions AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK ((NOT group_locked((group_name)::text)));

CREATE POLICY "Lock group_predictions updates after group kickoff" ON public.group_predictions AS RESTRICTIVE FOR UPDATE TO public
  USING ((NOT group_locked((group_name)::text)))
  WITH CHECK ((NOT group_locked((group_name)::text)));

CREATE POLICY "Pool members delete group predictions" ON public.group_predictions AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.id = group_predictions.member_id) AND (pm.user_id = auth.uid())))));

CREATE POLICY "Pool members insert group predictions" ON public.group_predictions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.id = group_predictions.member_id) AND (pm.user_id = auth.uid()) AND (pm.pool_id = group_predictions.pool_id)))));

CREATE POLICY "Pool members read group predictions" ON public.group_predictions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.id = group_predictions.member_id) AND (pm.user_id = auth.uid())))));

CREATE POLICY "Pool members update group predictions" ON public.group_predictions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.id = group_predictions.member_id) AND (pm.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.id = group_predictions.member_id) AND (pm.user_id = auth.uid()) AND (pm.pool_id = group_predictions.pool_id)))));

CREATE POLICY "Users can insert their own issue reports" ON public.issue_reports AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY leaderboard_read ON public.leaderboard_cache AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.pool_id = leaderboard_cache.pool_id) AND (pm.user_id = auth.uid())))));

CREATE POLICY matches_read ON public.matches AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can read own transactions" ON public.points_transactions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Members insert own activity" ON public.pool_activity AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.id = pool_activity.member_id) AND (pm.user_id = auth.uid()) AND (pm.pool_id = pool_activity.pool_id)))));

CREATE POLICY "Pool members read pool activity" ON public.pool_activity AS PERMISSIVE FOR SELECT TO authenticated
  USING ((pool_id IN ( SELECT pm.pool_id
   FROM pool_members pm
  WHERE (pm.user_id = auth.uid()))));

CREATE POLICY members_insert ON public.pool_members AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY members_read ON public.pool_members AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY pools_insert ON public.pools AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = creator_id));

CREATE POLICY pools_read ON public.pools AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY pools_update ON public.pools AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = creator_id));

CREATE POLICY predictions_read ON public.predictions AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = ( SELECT pm.user_id
   FROM pool_members pm
  WHERE (pm.id = predictions.member_id))) OR ((EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = predictions.match_id) AND (m.locked_at IS NOT NULL) AND (m.locked_at <= now())))) AND (EXISTS ( SELECT 1
   FROM pool_members pm
  WHERE ((pm.pool_id = predictions.pool_id) AND (pm.user_id = auth.uid())))))));

CREATE POLICY predictions_update ON public.predictions AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM pool_members
  WHERE ((pool_members.user_id = auth.uid()) AND (pool_members.id = predictions.member_id)))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM pool_members
  WHERE ((pool_members.user_id = auth.uid()) AND (pool_members.id = predictions.member_id)))) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = predictions.match_id) AND ((m.locked_at IS NULL) OR (m.locked_at > now())))))));

CREATE POLICY predictions_write ON public.predictions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM pool_members
  WHERE ((pool_members.user_id = auth.uid()) AND (pool_members.id = predictions.member_id)))) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = predictions.match_id) AND ((m.locked_at IS NULL) OR (m.locked_at > now())))))));

CREATE POLICY "Members add own reactions" ON public.reactions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND (activity_id IN ( SELECT pa.id
   FROM (pool_activity pa
     JOIN pool_members pm ON ((pm.pool_id = pa.pool_id)))
  WHERE (pm.user_id = auth.uid())))));

CREATE POLICY "Members delete own reactions" ON public.reactions AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Pool members read reactions" ON public.reactions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((activity_id IN ( SELECT pa.id
   FROM (pool_activity pa
     JOIN pool_members pm ON ((pm.pool_id = pa.pool_id)))
  WHERE (pm.user_id = auth.uid()))));

CREATE POLICY "Users can insert their own third place rankings" ON public.third_place_rankings AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their own third place rankings" ON public.third_place_rankings AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can view their own third place rankings" ON public.third_place_rankings AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY users_own ON public.users AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = id));

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER on_issue_report_created AFTER INSERT ON public.issue_reports FOR EACH ROW EXECUTE FUNCTION handle_issue_report_email();
CREATE TRIGGER trg_score_winners_on_final AFTER UPDATE OF is_final ON public.matches FOR EACH ROW EXECUTE FUNCTION on_match_final_score_winners();
CREATE TRIGGER new_user_signup AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://ntfy.sh/poolcup-signups', 'POST', '{"Content-type":"application/json","Title":"New PoolCup Signup!"}', '{}', '5000');
CREATE TRIGGER sync_pool_member_names_after_user_update AFTER UPDATE OF display_name ON public.users FOR EACH ROW EXECUTE FUNCTION sync_pool_member_display_names();

-- NOTE: One more trigger lives on auth.users (outside the public schema, so not
-- emitted above). It creates the public.users row on signup. If doing a full
-- cold rebuild, recreate it:
--   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
