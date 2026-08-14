-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
-- Idempotent where possible.
--
-- Reconciles Premium Themes column + check from linked prod (pg_get_constraintdef).
-- Live: users.accent_theme text NULL; users_accent_theme_chk ANY ARRAY of
-- ocean/sunset/royal/crimson/slate (NULL allowed).

-- =============================================================================
-- 1. users.accent_theme
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS accent_theme text;

-- =============================================================================
-- 2. users_accent_theme_chk
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_accent_theme_chk'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_accent_theme_chk
      CHECK (
        accent_theme IS NULL
        OR (
          accent_theme = ANY (
            ARRAY[
              'ocean'::text,
              'sunset'::text,
              'royal'::text,
              'crimson'::text,
              'slate'::text
            ]
          )
        )
      );
  END IF;
END $$;
