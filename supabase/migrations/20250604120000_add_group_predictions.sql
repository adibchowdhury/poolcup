-- Winner Only pools: predicted group standings (rank 1–4 per group).

create table if not exists public.group_predictions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools (id) on delete cascade,
  member_id uuid not null references public.pool_members (id) on delete cascade,
  group_name char(1) not null check (group_name ~ '^[A-L]$'),
  standings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (pool_id, member_id, group_name)
);

comment on table public.group_predictions is
  'Winner Only pool group stage standings: JSON array of team names ordered 1st–4th.';

create index if not exists group_predictions_pool_member_idx
  on public.group_predictions (pool_id, member_id);

alter table public.group_predictions enable row level security;

create policy "Pool members read group predictions"
  on public.group_predictions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = group_predictions.member_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Pool members insert group predictions"
  on public.group_predictions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = group_predictions.member_id
        and pm.user_id = auth.uid()
        and pm.pool_id = group_predictions.pool_id
    )
  );

create policy "Pool members update group predictions"
  on public.group_predictions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = group_predictions.member_id
        and pm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = group_predictions.member_id
        and pm.user_id = auth.uid()
        and pm.pool_id = group_predictions.pool_id
    )
  );

create policy "Pool members delete group predictions"
  on public.group_predictions
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = group_predictions.member_id
        and pm.user_id = auth.uid()
    )
  );
