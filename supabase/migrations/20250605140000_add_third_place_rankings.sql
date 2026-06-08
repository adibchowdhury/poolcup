-- Winner Only pools: ranked list of 12 third-place teams (best 8 advance to R32).

create table if not exists public.third_place_rankings (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools (id) on delete cascade,
  member_id uuid not null references public.pool_members (id) on delete cascade,
  rankings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (pool_id, member_id)
);

comment on table public.third_place_rankings is
  'Winner Only pool third-place team rankings: JSON array of team names ordered 1st–12th among group 3rd-place finishers.';

create index if not exists third_place_rankings_pool_member_idx
  on public.third_place_rankings (pool_id, member_id);

alter table public.third_place_rankings enable row level security;

create policy "Pool members read third place rankings"
  on public.third_place_rankings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = third_place_rankings.member_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Pool members insert third place rankings"
  on public.third_place_rankings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = third_place_rankings.member_id
        and pm.user_id = auth.uid()
        and pm.pool_id = third_place_rankings.pool_id
    )
  );

create policy "Pool members update third place rankings"
  on public.third_place_rankings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = third_place_rankings.member_id
        and pm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = third_place_rankings.member_id
        and pm.user_id = auth.uid()
        and pm.pool_id = third_place_rankings.pool_id
    )
  );

create policy "Pool members delete third place rankings"
  on public.third_place_rankings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = third_place_rankings.member_id
        and pm.user_id = auth.uid()
    )
  );
