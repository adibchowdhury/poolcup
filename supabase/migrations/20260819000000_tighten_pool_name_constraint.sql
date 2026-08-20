-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Closes the client-bypass gap: pool creation is a direct client insert with no server-side app validation,
-- so the DB now enforces the app's 2-50 trimmed-length rule + blocks control characters.
-- NOT VALID: 4 legacy pools violate (two 1-char names, a 70-char and a 55-char name) and are grandfathered;
-- all new inserts/updates are enforced. Rename API independently enforces 2-50.
ALTER TABLE public.pools DROP CONSTRAINT IF EXISTS pools_name_len_chk;
ALTER TABLE public.pools ADD CONSTRAINT pools_name_valid_chk
  CHECK (char_length(btrim(name)) BETWEEN 2 AND 50 AND name !~ '[\x00-\x1F]') NOT VALID;
