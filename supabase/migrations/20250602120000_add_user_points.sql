-- Global user points (signup + referrals; separate from pool leaderboard_cache).

alter table public.users
  add column if not exists points integer not null default 0;

comment on column public.users.points is
  'Global lifetime points: signup bonus, referrals, etc.';

-- Sign-up: 50 points when public.users row is created from auth.users trigger.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, points)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      nullif(
        trim(
          coalesce(new.raw_user_meta_data->>'first_name', '') || ' ' ||
          coalesce(new.raw_user_meta_data->>'last_name', '')
        ),
        ''
      )
    ),
    50
  )
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, public.users.display_name);

  return new;
end;
$$;

-- Referral: +30 to pool creator (callable from join flow after pool_members insert).

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
  set points = points + 30
  where id = v_creator_id;
end;
$$;

revoke all on function public.award_referral_points(uuid) from public;
grant execute on function public.award_referral_points(uuid) to authenticated;

-- One-time backfill: existing accounts get signup bonus.
update public.users
set points = 50
where points = 0;
