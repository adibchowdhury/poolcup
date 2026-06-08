-- Store the tournament/event a pool was created for (e.g. FIFA World Cup 2026).

alter table public.pools
  add column if not exists event_name text not null default 'FIFA World Cup 2026';

comment on column public.pools.event_name is
  'Tournament or event label shown on pool cards (e.g. FIFA World Cup 2026).';
