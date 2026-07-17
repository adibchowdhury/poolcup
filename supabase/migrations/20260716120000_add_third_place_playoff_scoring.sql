-- Add knockout scoring support for the World Cup third-place playoff.
-- Round code: 'third'
-- Classic pools: exact score 15 + correct winner 6 (stacked)
-- Winner pools: correct winner 6

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
  v_reason text;
  v_is_knockout boolean;
  v_exact_points int;
  v_advance_points int;
begin
  select * into v_match from public.matches where id = p_match_id;

  if v_match.result_team1 is null or v_match.result_team2 is null then
    return;
  end if;

  -- Only score a finished match. Live updates just refresh the displayed score.
  if not coalesce(v_match.is_final, false) then
    return;
  end if;

  v_is_knockout := v_match.round in ('r32', 'r16', 'qf', 'sf', 'third', 'final');

  for v_prediction in
    select p.*, pl.scoring_style, pm.user_id as predictor_user_id
    from public.predictions p
    join public.pools pl on pl.id = p.pool_id
    join public.pool_members pm on pm.id = p.member_id
    where p.match_id = p_match_id
  loop
    v_points := 0;
    v_old_points := coalesce(v_prediction.points_awarded, 0);
    v_exact_points := 0;
    v_advance_points := 0;

    if v_is_knockout then
      if v_prediction.scoring_style = 'winner' then
        v_advance_points := case v_match.round
          when 'r32'   then 3
          when 'r16'   then 4
          when 'qf'    then 5
          when 'sf'    then 6
          when 'third' then 6
          when 'final' then 8
          else 0
        end;
        if v_prediction.advance_pick is null
           or v_match.advancing_team is null
           or v_prediction.advance_pick <> v_match.advancing_team then
          v_advance_points := 0;
        end if;
        v_points := v_advance_points;
      else
        v_exact_points := case v_match.round
          when 'r32'   then 7
          when 'r16'   then 10
          when 'qf'    then 12
          when 'sf'    then 15
          when 'third' then 15
          when 'final' then 20
          else 0
        end;
        if v_prediction.pred_team1 <> v_match.result_team1
           or v_prediction.pred_team2 <> v_match.result_team2 then
          v_exact_points := 0;
        end if;

        v_advance_points := case v_match.round
          when 'r32'   then 3
          when 'r16'   then 4
          when 'qf'    then 5
          when 'sf'    then 6
          when 'third' then 6
          when 'final' then 8
          else 0
        end;
        if v_prediction.advance_pick is null
           or v_match.advancing_team is null
           or v_prediction.advance_pick <> v_match.advancing_team then
          v_advance_points := 0;
        end if;

        v_points := v_exact_points + v_advance_points;
      end if;
    elsif v_prediction.scoring_style = 'winner' then
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
      elsif v_prediction.pred_team1 = v_prediction.pred_team2
         and v_match.result_team1 = v_match.result_team2 then
        v_points := 3;
      elsif (v_prediction.pred_team1 > v_prediction.pred_team2
             and v_match.result_team1 > v_match.result_team2)
         or (v_prediction.pred_team1 < v_prediction.pred_team2
             and v_match.result_team1 < v_match.result_team2) then
        v_points := 2;
      end if;
    end if;

    v_delta := v_points - v_old_points;

    update public.predictions
    set points_awarded = v_points
    where id = v_prediction.id;

    if v_delta <> 0 then
      update public.users
      set points = points + v_delta
      where id = v_prediction.predictor_user_id;

      insert into public.point_events (user_id, points, reason, created_at)
      values (v_prediction.predictor_user_id, v_delta, 'match_prediction', now());
    end if;

    v_reason := 'match_prediction';
  end loop;
end;
$function$;
