drop policy if exists "predictions_read" on public.predictions;

create policy "predictions_read"
on public.predictions
for select
to authenticated
using (
  (exists (
    select 1 from public.matches m
    where m.id = predictions.match_id and m.is_final = true
  ))
  or
  (auth.uid() = (
    select pool_members.user_id
    from public.pool_members
    where pool_members.id = predictions.member_id
  ))
);
