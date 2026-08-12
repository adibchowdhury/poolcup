-- Documentation / rebuild-parity: allow match_reminder notification category.
-- Apply on live if the notifications category CHECK does not yet include match_reminder.

DO $$
DECLARE
  con_name text;
  def text;
BEGIN
  SELECT c.conname, pg_get_constraintdef(c.oid)
  INTO con_name, def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'notifications'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%category%'
  LIMIT 1;

  IF con_name IS NULL THEN
    RAISE NOTICE 'No category check constraint found on notifications';
    RETURN;
  END IF;

  IF def ILIKE '%match_reminder%' THEN
    RAISE NOTICE 'match_reminder already allowed (%)', con_name;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', con_name);
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_category_check
    CHECK (
      category = ANY (
        ARRAY[
          'pool_invite'::text,
          'friend'::text,
          'badge'::text,
          'level'::text,
          'prediction_scored'::text,
          'leaderboard'::text,
          'announcement'::text,
          'match_reminder'::text
        ]
      )
    );
END $$;
