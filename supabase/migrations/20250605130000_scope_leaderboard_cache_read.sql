drop policy if exists "leaderboard_read" on public.leaderboard_cache;
create policy "leaderboard_read"
on public.leaderboard_cache
for select
to authenticated
using (
  exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = leaderboard_cache.pool_id
      and pm.user_id = auth.uid()
  )
);
