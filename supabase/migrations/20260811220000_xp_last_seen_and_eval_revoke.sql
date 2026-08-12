-- last_seen watermark for welcome-back XP replay, and lock evaluate to service_role.
-- Do not mix with scoring deploys.

alter table public.users
  add column if not exists last_seen_xp integer,
  add column if not exists last_seen_level integer;

comment on column public.users.last_seen_xp is
  'Ledger XP total the user has been shown (toasts / welcome-back). Null = never tracked.';
comment on column public.users.last_seen_level is
  'Level last shown to the user. Null = never tracked.';

-- evaluate_user_achievements is SECURITY DEFINER and has no auth.uid() check.
-- Website calls it only from /api/xp/evaluate as the session user, via service_role.
revoke execute on function public.evaluate_user_achievements(uuid)
  from public, anon, authenticated;
grant execute on function public.evaluate_user_achievements(uuid)
  to service_role;
