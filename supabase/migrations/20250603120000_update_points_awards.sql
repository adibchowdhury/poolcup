-- Pool creation: +5 to creator. Invite join: +10 creator, +5 joiner.

create or replace function public.award_pool_created_points(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.award_pool_created_points(uuid) from public;
grant execute on function public.award_pool_created_points(uuid) to authenticated;

create or replace function public.award_referral_points(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    select 1
    from public.pool_members
    where pool_id = p_pool_id and user_id = v_joiner_id
  ) then
    raise exception 'Joiner is not a pool member';
  end if;

  update public.users
  set points = points + 10
  where id = v_creator_id;

  update public.users
  set points = points + 5
  where id = v_joiner_id;
end;
$$;
