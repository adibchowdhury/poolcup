-- Squad photo filename in public/pool_avatars/ (preset picker only).

alter table public.pools
  add column if not exists avatar text;

comment on column public.pools.avatar is
  'Squad photo filename in public/pool_avatars/ (e.g. goal_keeper.png). Null uses default placeholder.';
