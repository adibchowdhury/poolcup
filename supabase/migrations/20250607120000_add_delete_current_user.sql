-- Permanently delete the authenticated user's account and related data.

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pool_id uuid;
  v_member_ids uuid[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Pools created by this user (removes all member predictions in those pools).
  for v_pool_id in
    select id from public.pools where creator_id = v_uid
  loop
    delete from public.predictions where pool_id = v_pool_id;
    delete from public.leaderboard_cache where pool_id = v_pool_id;
    delete from public.pool_members where pool_id = v_pool_id;
    delete from public.pools where id = v_pool_id;
  end loop;

  select coalesce(array_agg(id), '{}')
  into v_member_ids
  from public.pool_members
  where user_id = v_uid;

  if coalesce(array_length(v_member_ids, 1), 0) > 0 then
    delete from public.predictions where member_id = any (v_member_ids);
    delete from public.group_predictions where member_id = any (v_member_ids);
    delete from public.third_place_rankings where member_id = any (v_member_ids);
    delete from public.pool_members where user_id = v_uid;
  end if;

  delete from public.points_transactions where user_id = v_uid;

  delete from public.users where id = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_current_user() from public;
grant execute on function public.delete_current_user() to authenticated;
