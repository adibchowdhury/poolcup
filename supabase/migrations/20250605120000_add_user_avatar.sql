-- User-chosen profile avatar (filename in public/avatars/).

alter table public.users
  add column if not exists avatar text;

comment on column public.users.avatar is
  'Avatar filename in public/avatars/ (e.g. level-1.png). Null uses default.';
