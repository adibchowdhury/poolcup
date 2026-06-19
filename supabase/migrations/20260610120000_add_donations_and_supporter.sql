-- Stripe donation tracking (webhook inserts via service role).

alter table public.users
  add column if not exists is_supporter boolean not null default false;

comment on column public.users.is_supporter is
  'True after a completed Stripe donation (checkout.session.completed webhook).';

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  stripe_event_id text not null,
  stripe_session_id text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (char_length(currency) >= 3),
  created_at timestamptz not null default now(),
  constraint donations_stripe_event_id_key unique (stripe_event_id)
);

create index if not exists donations_user_id_idx on public.donations (user_id);

alter table public.donations enable row level security;
