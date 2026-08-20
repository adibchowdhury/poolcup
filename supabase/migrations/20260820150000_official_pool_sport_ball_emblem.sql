-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
--
-- Official pools: set emblem_url to the sport-ball public path on create.
-- Paths match src/lib/sport-display.ts → /public/sports/*.png
--
-- Also applied via MCP: existing-pools backfill UPDATE (official pools with
-- null/blank emblem_url → sport-ball path from sporting_events.sport). See
-- the UPDATE block at the bottom of this file (already run on production).

CREATE OR REPLACE FUNCTION public.ensure_official_pools()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_system_host uuid := 'd09d34a9-11c0-4cdd-ab7f-d5b9edf4ff72';
  v_event record;
  v_pool_id uuid;
  v_created int := 0;
  v_pool_name text;
  v_emblem_url text;
BEGIN
  FOR v_event IN
    SELECT se.id, se.name, se.sport
    FROM public.sporting_events se
    WHERE se.status IN ('live','upcoming')
      AND NOT EXISTS (
        SELECT 1 FROM public.pools p
        WHERE p.event_id = se.id AND p.is_official = true
      )
  LOOP
    v_pool_name := 'Official ' || v_event.name || ' Pool';

    v_emblem_url := CASE lower(trim(coalesce(v_event.sport, '')))
      WHEN 'soccer' THEN '/sports/soccer.png'
      WHEN 'football' THEN '/sports/soccer.png'
      WHEN 'basketball' THEN '/sports/basketball.png'
      WHEN 'american_football' THEN '/sports/football.png'
      WHEN 'nfl' THEN '/sports/football.png'
      WHEN 'hockey' THEN '/sports/hockey.png'
      WHEN 'nhl' THEN '/sports/hockey.png'
      WHEN 'baseball' THEN '/sports/baseball.png'
      WHEN 'mlb' THEN '/sports/baseball.png'
      WHEN 'cricket' THEN '/sports/cricket.png'
      WHEN 'tennis' THEN '/sports/tennis.png'
      WHEN 'volleyball' THEN '/sports/volleyball.png'
      ELSE NULL
    END;

    INSERT INTO public.pools (
      id, name, creator_id, event_id, scoring_style,
      is_official, is_public, accepting_members, invite_code, emblem_url
    )
    VALUES (
      gen_random_uuid(), v_pool_name, v_system_host, v_event.id, 'classic',
      true, true, true, substr(md5(gen_random_uuid()::text), 1, 8), v_emblem_url
    )
    RETURNING id INTO v_pool_id;

    INSERT INTO public.pool_members (id, pool_id, user_id, display_name, joined_at)
    SELECT gen_random_uuid(), v_pool_id, v_system_host, u.display_name, now()
    FROM public.users u WHERE u.id = v_system_host
    ON CONFLICT DO NOTHING;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_official_pools() TO service_role;

-- Existing official pools backfill (already applied to production via MCP).
UPDATE public.pools p
SET emblem_url = CASE lower(trim(coalesce(se.sport, '')))
  WHEN 'soccer' THEN '/sports/soccer.png'
  WHEN 'football' THEN '/sports/soccer.png'
  WHEN 'basketball' THEN '/sports/basketball.png'
  WHEN 'american_football' THEN '/sports/football.png'
  WHEN 'nfl' THEN '/sports/football.png'
  WHEN 'hockey' THEN '/sports/hockey.png'
  WHEN 'nhl' THEN '/sports/hockey.png'
  WHEN 'baseball' THEN '/sports/baseball.png'
  WHEN 'mlb' THEN '/sports/baseball.png'
  WHEN 'cricket' THEN '/sports/cricket.png'
  WHEN 'tennis' THEN '/sports/tennis.png'
  WHEN 'volleyball' THEN '/sports/volleyball.png'
  ELSE NULL
END
FROM public.sporting_events se
WHERE se.id = p.event_id
  AND p.is_official = true
  AND (p.emblem_url IS NULL OR btrim(p.emblem_url) = '');
