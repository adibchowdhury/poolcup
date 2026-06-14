alter table public.matches
  add column if not exists updated_at timestamptz default now();

comment on column public.matches.updated_at is
  'Set when elapsed_minute advances; marks when the current match minute began.';
