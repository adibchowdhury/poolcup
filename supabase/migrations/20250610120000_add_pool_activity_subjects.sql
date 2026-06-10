-- Per-area pool activity (group, third-place, match).

alter table public.pool_activity
  add column if not exists subject_type text,
  add column if not exists group_name char(1) check (group_name is null or group_name ~ '^[A-L]$'),
  add column if not exists match_id uuid references public.matches (id) on delete set null;

comment on column public.pool_activity.subject_type is
  'Prediction area: group, third_place, or match.';

create index if not exists pool_activity_pool_created_idx
  on public.pool_activity (pool_id, created_at desc);
