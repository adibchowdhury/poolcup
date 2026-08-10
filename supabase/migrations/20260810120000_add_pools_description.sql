-- Additive: optional pool description for create/settings.
alter table public.pools
  add column if not exists description text;

comment on column public.pools.description is
  'Optional short description set at pool creation (nullable).';
