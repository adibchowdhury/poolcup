-- Session-level pool activity feed (prediction saves, etc.).

create table if not exists public.pool_activity (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools (id) on delete cascade,
  member_id uuid not null references public.pool_members (id) on delete cascade,
  type text not null,
  created_at timestamptz not null default now()
);

comment on table public.pool_activity is
  'Per-member activity log within a pool (e.g. prediction saves).';

create index if not exists pool_activity_pool_member_idx
  on public.pool_activity (pool_id, member_id);

alter table public.pool_activity enable row level security;

create policy "Pool members read pool activity"
  on public.pool_activity
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pool_members pm
      where pm.pool_id = pool_activity.pool_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Pool members insert own pool activity"
  on public.pool_activity
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.pool_members pm
      where pm.id = pool_activity.member_id
        and pm.user_id = auth.uid()
        and pm.pool_id = pool_activity.pool_id
    )
  );
