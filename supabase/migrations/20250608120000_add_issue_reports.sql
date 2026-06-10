-- In-app issue reports from authenticated users.

create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  page_url text not null,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

comment on table public.issue_reports is
  'User-submitted bug reports and feedback from the authenticated app shell.';

create index if not exists issue_reports_user_id_idx
  on public.issue_reports (user_id);

alter table public.issue_reports enable row level security;

create policy "Users insert own issue reports"
  on public.issue_reports
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users read own issue reports"
  on public.issue_reports
  for select
  to authenticated
  using (user_id = auth.uid());
