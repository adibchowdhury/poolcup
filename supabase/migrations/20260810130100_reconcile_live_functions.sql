-- =====================================================================
-- Reconciliation migration (part 2): CURRENT LIVE definitions of the
-- large scoring / achievement functions. Applied live via MCP during
-- development; committed here so the repo can rebuild the DB correctly.
--
-- SAFETY: CREATE OR REPLACE only. Re-applying is a no-op on live.
-- Point/scoring logic captured VERBATIM from the live database.
-- Baselines verified: match f84b2475=2089, 10e40ba6=765, 8643d302=1237.
-- =====================================================================

-- ---------------------------------------------------------------------
-- calculate_match_points: config-driven points + deterministic tie-break
--   classic rank order: points desc -> exact_scores desc -> correct_winners desc -> member_id
-- ---------------------------------------------------------------------
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
  v_exact int;
  v_winner int;
  v_draw int;
  v_reason text;
  v_winner_pool_touched boolean := false;
  v_is_knockout boolean;
  v_eff_pick smallint;
  v_adv smallint;
  v_exact_hit boolean;
  v_advance_hit boolean;
  v_ko_exact int;
  v_ko_winner int;
  v_ko_draw int;
begin
  select * into v_match from public.matches where id = p_match_id;

  if v_match.result_team1 is null or v_match.result_team2 is null then
    return;
  end if;
  if not coalesce(v_match.is_final, false) then
    return;
  end if;

  case v_match.round
    when 'r32'   then v_ko_exact := 7;  v_ko_winner := 3; v_ko_draw := 0;
    when 'r16'   then v_ko_exact := 10; v_ko_winner := 4; v_ko_draw := 0;
    when 'qf'    then v_ko_exact := 12; v_ko_winner := 5; v_ko_draw := 0;
    when 'sf'    then v_ko_exact := 15; v_ko_winner := 6; v_ko_draw := 0;
    when 'third' then v_ko_exact := 15; v_ko_winner := 6; v_ko_draw := 0;
    when 'final' then v_ko_exact := 20; v_ko_winner := 8; v_ko_draw := 0;
    else              v_ko_exact := 5;  v_ko_winner := 2; v_ko_draw := 3;
  end case;

  v_is_knockout := v_match.round in ('r32','r16','qf','sf','third','final');

  v_adv := coalesce(
    v_match.advancing_team,
    case
      when v_match.result_team1 > v_match.result_team2 then 1
      when v_match.result_team2 > v_match.result_team1 then 2
      else null
    end
  );

  for v_prediction in
    select p.*, pl.scoring_style, pm.user_id as predictor_user_id,
           pl.score_exact_points, pl.score_winner_points, pl.score_draw_points
    from public.predictions p
    join public.pools pl on pl.id = p.pool_id
    join public.pool_members pm on pm.id = p.member_id
    where p.match_id = p_match_id
  loop
    if v_is_knockout then
      v_exact := v_ko_exact; v_winner := v_ko_winner; v_draw := v_ko_draw;
    else
      v_exact  := coalesce(v_prediction.score_exact_points, 5);
      v_winner := coalesce(v_prediction.score_winner_points, 2);
      v_draw   := coalesce(v_prediction.score_draw_points, 3);
    end if;

    v_points := 0;
    v_old_points := coalesce(v_prediction.points_awarded, 0);
    v_exact_hit := false;
    v_advance_hit := false;

    if v_prediction.scoring_style = 'winner' then
      if v_is_knockout then
        v_eff_pick := coalesce(
          v_prediction.advance_pick,
          case
            when v_prediction.pred_team1 > v_prediction.pred_team2 then 1
            when v_prediction.pred_team2 > v_prediction.pred_team1 then 2
            else null
          end);
        v_advance_hit := (v_eff_pick is not null and v_adv is not null and v_eff_pick = v_adv);
        if v_advance_hit then
          v_points := v_winner;
        end if;
      else
        if v_prediction.pred_team1 = v_prediction.pred_team2
           and v_match.result_team1 = v_match.result_team2 then
          v_points := v_draw;
        elsif (v_prediction.pred_team1 > v_prediction.pred_team2
               and v_match.result_team1 > v_match.result_team2)
           or (v_prediction.pred_team1 < v_prediction.pred_team2
               and v_match.result_team1 < v_match.result_team2) then
          v_points := v_winner;
        end if;
      end if;
      v_winner_pool_touched := true;

    elsif v_is_knockout then
      v_exact_hit := (v_prediction.pred_team1 = v_match.result_team1
                      and v_prediction.pred_team2 = v_match.result_team2);
      v_eff_pick := coalesce(
        v_prediction.advance_pick,
        case
          when v_prediction.pred_team1 > v_prediction.pred_team2 then 1
          when v_prediction.pred_team2 > v_prediction.pred_team1 then 2
          else null
        end
      );
      v_advance_hit := (v_eff_pick is not null and v_adv is not null and v_eff_pick = v_adv);
      v_points := (case when v_exact_hit then v_exact else 0 end)
                + (case when v_advance_hit then v_winner else 0 end);

    else
      if v_prediction.pred_team1 = v_match.result_team1
         and v_prediction.pred_team2 = v_match.result_team2 then
        v_points := v_exact;
        v_exact_hit := true;
      elsif v_prediction.pred_team1 = v_prediction.pred_team2
         and v_match.result_team1 = v_match.result_team2 then
        v_points := v_draw;
      elsif (v_prediction.pred_team1 > v_prediction.pred_team2
             and v_match.result_team1 > v_match.result_team2)
         or (v_prediction.pred_team1 < v_prediction.pred_team2
             and v_match.result_team1 < v_match.result_team2) then
        v_points := v_winner;
      end if;
    end if;

    v_delta := v_points - v_old_points;

    update public.predictions set points_awarded = v_points where id = v_prediction.id;

    if v_delta <> 0 then
      update public.users set points = points + v_delta
      where id = v_prediction.predictor_user_id;

      v_reason := case
        when v_prediction.scoring_style = 'winner' and v_is_knockout then 'correct_advance'
        when v_prediction.scoring_style <> 'winner' and v_is_knockout then
          case
            when v_exact_hit and v_advance_hit then 'knockout_exact_and_advance'
            when v_exact_hit then 'exact_score'
            when v_advance_hit then 'correct_advance'
            else 'knockout_points'
          end
        when v_prediction.pred_team1 = v_match.result_team1
         and v_prediction.pred_team2 = v_match.result_team2 then 'exact_score'
        when v_prediction.pred_team1 = v_prediction.pred_team2
         and v_match.result_team1 = v_match.result_team2 then 'correct_draw'
        else 'correct_winner'
      end;

      insert into public.points_transactions (user_id, points, reason, created_at)
      values (v_prediction.predictor_user_id, v_delta, v_reason, now());
    end if;
  end loop;

  insert into public.leaderboard_cache
    (pool_id, member_id, total_points, correct_winners, exact_scores, rank, prev_rank, climb_streak, updated_at)
  select
    p.pool_id, p.member_id,
    coalesce(sum(p.points_awarded), 0),
    count(*) filter (where p.points_awarded >= 2),
    count(*) filter (
      where m.result_team1 is not null and m.result_team2 is not null
        and p.pred_team1 = m.result_team1 and p.pred_team2 = m.result_team2
    ),
    rank() over (
      partition by p.pool_id
      order by
        coalesce(sum(p.points_awarded), 0) desc,
        count(*) filter (
          where m.result_team1 is not null and m.result_team2 is not null
            and p.pred_team1 = m.result_team1 and p.pred_team2 = m.result_team2
        ) desc,
        count(*) filter (where p.points_awarded >= 2) desc,
        p.member_id
    ),
    coalesce((select lc.rank from public.leaderboard_cache lc
              where lc.pool_id = p.pool_id and lc.member_id = p.member_id), 0),
    0,
    now()
  from public.predictions p
  join public.matches m on m.id = p.match_id
  join public.pools pl on pl.id = p.pool_id
  where pl.scoring_style <> 'winner'
    and p.pool_id in (select distinct pool_id from public.predictions where match_id = p_match_id)
  group by p.pool_id, p.member_id
  on conflict (pool_id, member_id) do update set
    prev_rank = leaderboard_cache.rank,
    total_points = excluded.total_points,
    correct_winners = excluded.correct_winners,
    exact_scores = excluded.exact_scores,
    climb_streak = case
      when leaderboard_cache.rank = 0 then 0
      when excluded.rank < leaderboard_cache.rank then leaderboard_cache.climb_streak + 1
      when excluded.rank > leaderboard_cache.rank then 0
      else leaderboard_cache.climb_streak
    end,
    rank = excluded.rank,
    updated_at = now();

  if v_winner_pool_touched then
    perform public.rebuild_all_winner_leaderboards();
  end if;
end;
$function$;

-- ---------------------------------------------------------------------
-- rebuild_all_winner_leaderboards: stable deterministic tie-break (points desc, member_id)
-- ---------------------------------------------------------------------
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
    pm.pool_id, pm.id,
    coalesce(g.grp_pts,0) + coalesce(tp.tp_pts,0) + coalesce(pr.pred_pts,0),
    0, 0,
    rank() over (partition by pm.pool_id
      order by coalesce(g.grp_pts,0) + coalesce(tp.tp_pts,0) + coalesce(pr.pred_pts,0) desc,
               pm.id),
    coalesce((select lc.rank from public.leaderboard_cache lc
              where lc.pool_id = pm.pool_id and lc.member_id = pm.id), 0),
    now()
  from public.pool_members pm
  join public.pools p on p.id = pm.pool_id and p.scoring_style = 'winner'
  left join (select member_id, sum(coalesce(points_awarded,0)) grp_pts
             from public.group_predictions group by member_id) g on g.member_id = pm.id
  left join (select pool_id, user_id, sum(coalesce(points_awarded,0)) tp_pts
             from public.third_place_rankings group by pool_id, user_id) tp
            on tp.pool_id = pm.pool_id and tp.user_id = pm.user_id
  left join (select member_id, sum(coalesce(points_awarded,0)) pred_pts
             from public.predictions group by member_id) pr on pr.member_id = pm.id
  on conflict (pool_id, member_id) do update set
    prev_rank = public.leaderboard_cache.rank,
    total_points = excluded.total_points,
    correct_winners = 0,
    exact_scores = 0,
    rank = excluded.rank,
    updated_at = now();
end;
$function$;

-- ---------------------------------------------------------------------
-- void_match_points: reverse awarded points for a voided match (delta-safe, idempotent)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_match_points(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prediction record;
  v_old_points int;
  v_delta int;
  v_winner_pool_touched boolean := false;
begin
  for v_prediction in
    select p.*, pl.scoring_style, pm.user_id as predictor_user_id
    from public.predictions p
    join public.pools pl on pl.id = p.pool_id
    join public.pool_members pm on pm.id = p.member_id
    where p.match_id = p_match_id
  loop
    v_old_points := coalesce(v_prediction.points_awarded, 0);
    v_delta := 0 - v_old_points;
    update public.predictions set points_awarded = 0 where id = v_prediction.id;
    if v_prediction.scoring_style = 'winner' then
      v_winner_pool_touched := true;
    end if;
    if v_delta <> 0 then
      update public.users set points = points + v_delta
      where id = v_prediction.predictor_user_id;
      insert into public.points_transactions (user_id, points, reason, created_at)
      values (v_prediction.predictor_user_id, v_delta, 'match_voided', now());
    end if;
  end loop;

  insert into public.leaderboard_cache
    (pool_id, member_id, total_points, correct_winners, exact_scores, rank, prev_rank, climb_streak, updated_at)
  select
    p.pool_id, p.member_id,
    coalesce(sum(p.points_awarded), 0),
    count(*) filter (where p.points_awarded >= 2),
    count(*) filter (
      where m.result_team1 is not null and m.result_team2 is not null
        and p.pred_team1 = m.result_team1 and p.pred_team2 = m.result_team2
    ),
    rank() over (partition by p.pool_id order by coalesce(sum(p.points_awarded), 0) desc),
    coalesce((select lc.rank from public.leaderboard_cache lc
              where lc.pool_id = p.pool_id and lc.member_id = p.member_id), 0),
    0,
    now()
  from public.predictions p
  join public.matches m on m.id = p.match_id
  join public.pools pl on pl.id = p.pool_id
  where pl.scoring_style <> 'winner'
    and p.pool_id in (select distinct pool_id from public.predictions where match_id = p_match_id)
  group by p.pool_id, p.member_id
  on conflict (pool_id, member_id) do update set
    prev_rank = leaderboard_cache.rank,
    total_points = excluded.total_points,
    correct_winners = excluded.correct_winners,
    exact_scores = excluded.exact_scores,
    climb_streak = case
      when leaderboard_cache.rank = 0 then 0
      when excluded.rank < leaderboard_cache.rank then leaderboard_cache.climb_streak + 1
      when excluded.rank > leaderboard_cache.rank then 0
      else leaderboard_cache.climb_streak
    end,
    rank = excluded.rank,
    updated_at = now();

  if v_winner_pool_touched then
    perform public.rebuild_all_winner_leaderboards();
  end if;
end;
$function$;

-- ---------------------------------------------------------------------
-- evaluate_user_achievements: data-driven badge evaluator (current live)
--   includes metrics: max_members_in_won_pool, messages_sent, reactions_received
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_user_achievements(p_user_id uuid)
 RETURNS TABLE(newly_awarded text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m_predictions_made integer := 0; m_correct_predictions integer := 0; m_exact_scores integer := 0;
  m_points_total integer := 0; m_pools_created integer := 0; m_pools_joined integer := 0;
  m_official_pools_joined integer := 0; m_distinct_events integer := 0; m_first_place integer := 0;
  m_top3 integer := 0; m_best_rank integer := NULL; m_max_created_members integer := 0;
  m_official_top3 integer := 0; m_custom_avatar integer := 0; m_account_created integer := 1;
  m_achievements_earned integer := 0; m_streak_days integer := 0; m_consecutive_correct integer := 0;
  m_account_age_days integer := 0; m_perfect_matchdays integer := 0; m_perfect_events integer := 0;
  m_invites_converted integer := 0;
  m_max_won_pool_members integer := 0;
  m_messages_sent integer := 0;
  m_reactions_received integer := 0;
BEGIN
  SELECT count(*)::int, count(*) FILTER (WHERE p.points_awarded > 0)::int,
    count(*) FILTER (WHERE p.result_ok AND p.pred_team1 = p.result_team1 AND p.pred_team2 = p.result_team2)::int,
    COALESCE(sum(p.points_awarded),0)::int
  INTO m_predictions_made, m_correct_predictions, m_exact_scores, m_points_total
  FROM (SELECT pr.*, m.result_team1, m.result_team2,
          (m.is_final AND m.result_team1 IS NOT NULL AND m.result_team2 IS NOT NULL) AS result_ok
        FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
        LEFT JOIN public.matches m ON m.id = pr.match_id WHERE pm.user_id = p_user_id) p;

  SELECT m_points_total
    + COALESCE((SELECT sum(gp.points_awarded) FROM public.group_predictions gp
        JOIN public.pool_members pm ON pm.id = gp.member_id WHERE pm.user_id = p_user_id),0)
    + COALESCE((SELECT sum(tpr.points_awarded) FROM public.third_place_rankings tpr
        WHERE tpr.user_id = p_user_id),0)
  INTO m_points_total;

  SELECT count(*)::int INTO m_pools_created FROM public.pools WHERE creator_id = p_user_id;
  SELECT COALESCE(max(mc.cnt),0)::int INTO m_max_created_members
  FROM (SELECT po.id, count(pmx.id) AS cnt FROM public.pools po
        LEFT JOIN public.pool_members pmx ON pmx.pool_id = po.id
        WHERE po.creator_id = p_user_id GROUP BY po.id) mc;

  SELECT count(DISTINCT pm.pool_id)::int, count(DISTINCT pm.pool_id) FILTER (WHERE po.is_official)::int,
         count(DISTINCT po.event_id)::int
  INTO m_pools_joined, m_official_pools_joined, m_distinct_events
  FROM public.pool_members pm JOIN public.pools po ON po.id = pm.pool_id WHERE pm.user_id = p_user_id;

  SELECT count(*) FILTER (WHERE lc.rank = 1)::int, count(*) FILTER (WHERE lc.rank <= 3)::int,
         min(lc.rank)::int, count(*) FILTER (WHERE lc.rank <= 3 AND po.is_official)::int
  INTO m_first_place, m_top3, m_best_rank, m_official_top3
  FROM public.leaderboard_cache lc JOIN public.pool_members pm ON pm.id = lc.member_id
  JOIN public.pools po ON po.id = lc.pool_id WHERE pm.user_id = p_user_id;

  SELECT COALESCE(max(mc.cnt),0)::int INTO m_max_won_pool_members
  FROM public.leaderboard_cache lc
  JOIN public.pool_members pm ON pm.id = lc.member_id
  JOIN (SELECT pool_id, count(*) AS cnt FROM public.pool_members GROUP BY pool_id) mc ON mc.pool_id = lc.pool_id
  WHERE pm.user_id = p_user_id AND lc.rank = 1;

  SELECT count(*)::int INTO m_messages_sent
  FROM public.pool_messages WHERE user_id = p_user_id AND coalesce(message_type,'user') = 'user';

  SELECT count(*)::int INTO m_reactions_received
  FROM public.message_reactions r
  JOIN public.pool_messages msg ON msg.id = r.message_id
  WHERE msg.user_id = p_user_id AND r.user_id <> p_user_id;

  SELECT CASE WHEN custom_avatar_url IS NOT NULL AND custom_avatar_url <> '' THEN 1 ELSE 0 END,
         COALESCE(EXTRACT(DAY FROM (now() - created_at))::int, 0)
  INTO m_custom_avatar, m_account_age_days FROM public.users WHERE id = p_user_id;

  SELECT count(*)::int INTO m_achievements_earned FROM public.user_achievements WHERE user_id = p_user_id;
  SELECT count(*)::int INTO m_invites_converted FROM public.referrals WHERE referrer_id = p_user_id;

  WITH days AS (SELECT DISTINCT date(pr.submitted_at AT TIME ZONE 'UTC') AS d
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id WHERE pm.user_id = p_user_id),
  grouped AS (SELECT d, d - (row_number() OVER (ORDER BY d))::int AS grp FROM days)
  SELECT COALESCE(max(run_len),0)::int INTO m_streak_days
  FROM (SELECT count(*) AS run_len FROM grouped GROUP BY grp) r;

  WITH per_match AS (SELECT m.id AS match_id, m.kickoff_at, max((pr.points_awarded > 0)::int) AS is_correct
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id WHERE pm.user_id = p_user_id AND m.is_final = true
    GROUP BY m.id, m.kickoff_at),
  seq AS (SELECT match_id, kickoff_at, is_correct, row_number() OVER (ORDER BY kickoff_at, match_id) AS rn FROM per_match),
  grp AS (SELECT *, rn - sum(is_correct) OVER (ORDER BY kickoff_at, match_id ROWS UNBOUNDED PRECEDING) AS island FROM seq)
  SELECT COALESCE(max(run_len),0)::int INTO m_consecutive_correct
  FROM (SELECT count(*) AS run_len FROM grp WHERE is_correct = 1 GROUP BY island) r;

  WITH per_match AS (SELECT date(m.kickoff_at AT TIME ZONE 'UTC') AS d, m.id AS match_id,
      max((pr.points_awarded > 0)::int) AS is_correct
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id WHERE pm.user_id = p_user_id AND m.is_final = true
    GROUP BY date(m.kickoff_at AT TIME ZONE 'UTC'), m.id)
  SELECT count(*)::int INTO m_perfect_matchdays
  FROM (SELECT d FROM per_match GROUP BY d HAVING count(*) >= 2 AND count(*) = sum(is_correct)) fd;

  WITH uem AS (SELECT m.event_id, m.id AS match_id, max((pr.points_awarded > 0)::int) AS is_correct
    FROM public.predictions pr JOIN public.pool_members pm ON pm.id = pr.member_id
    JOIN public.matches m ON m.id = pr.match_id WHERE pm.user_id = p_user_id AND m.is_final = true
    GROUP BY m.event_id, m.id),
  et AS (SELECT event_id, count(*) AS total_final FROM public.matches WHERE is_final = true GROUP BY event_id),
  pue AS (SELECT uem.event_id, count(*) AS predicted, sum(uem.is_correct) AS correct, et.total_final
    FROM uem JOIN et ON et.event_id = uem.event_id GROUP BY uem.event_id, et.total_final)
  SELECT CASE WHEN EXISTS (SELECT 1 FROM pue WHERE predicted >= 0.8 * total_final AND predicted = correct)
    THEN 1 ELSE 0 END INTO m_perfect_events;

  RETURN QUERY
  WITH metric_values(condition_metric, value) AS (VALUES
      ('account_created', m_account_created), ('custom_avatar_set', m_custom_avatar),
      ('predictions_made', m_predictions_made), ('correct_predictions', m_correct_predictions),
      ('exact_scores', m_exact_scores), ('points_total', m_points_total),
      ('pools_created', m_pools_created), ('pools_joined', m_pools_joined),
      ('official_pools_joined', m_official_pools_joined), ('distinct_events_participated', m_distinct_events),
      ('first_place_finishes', m_first_place), ('top3_finishes', m_top3),
      ('best_finish_rank_at_or_below', COALESCE(m_best_rank, 2147483647)),
      ('official_top3_finishes', m_official_top3), ('max_members_in_created_pool', m_max_created_members),
      ('achievements_earned', m_achievements_earned), ('streak_days', m_streak_days),
      ('consecutive_correct', m_consecutive_correct), ('account_age_days', m_account_age_days),
      ('perfect_matchdays', m_perfect_matchdays), ('perfect_events', m_perfect_events),
      ('invites_converted', m_invites_converted),
      ('max_members_in_won_pool', m_max_won_pool_members),
      ('messages_sent', m_messages_sent),
      ('reactions_received', m_reactions_received)
  ),
  earned AS (
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT p_user_id, a.id FROM public.achievements a
    JOIN metric_values mv ON mv.condition_metric = a.condition_metric
    WHERE ((a.condition_metric <> 'best_finish_rank_at_or_below' AND mv.value >= a.threshold)
        OR (a.condition_metric = 'best_finish_rank_at_or_below' AND mv.value <= a.threshold))
      AND NOT EXISTS (SELECT 1 FROM public.user_achievements ua
                      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id
  )
  SELECT achievement_id FROM earned;
END;
$function$;

-- =====================================================================
-- END reconciliation part 2.
-- =====================================================================
