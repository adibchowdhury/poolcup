-- Run in Supabase SQL Editor after deploying app changes.
-- Ensures public.users gets display_name from sign-up metadata.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      trim(
        coalesce(new.raw_user_meta_data->>'first_name', '') || ' ' ||
        coalesce(new.raw_user_meta_data->>'last_name', '')
      )
    )
  )
  on conflict (id) do update
  set display_name = excluded.display_name;

  return new;
end;
$$;

-- Recreate trigger if needed (adjust trigger name to match your project):
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();
