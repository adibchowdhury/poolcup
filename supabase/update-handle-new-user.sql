-- Run in Supabase SQL Editor after deploying app changes.
-- Ensures public.users gets display_name from sign-up metadata and 50 signup points.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, points)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      nullif(
        trim(
          coalesce(new.raw_user_meta_data->>'first_name', '') || ' ' ||
          coalesce(new.raw_user_meta_data->>'last_name', '')
        ),
        ''
      )
    ),
    50
  )
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, public.users.display_name);

  return new;
end;
$$;

-- Recreate trigger if needed (adjust trigger name to match your project):
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();
