-- =============================================================================
-- Applied to production via MCP. Do NOT run against production.
-- Idempotent reconciliation for discord_event_log (Discord Pucky outbox).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.discord_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel_key text NOT NULL DEFAULT 'soccer',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  discord_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discord_event_log_status_check
    CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS discord_event_log_dedupe
  ON public.discord_event_log (match_id, event_type, channel_key);

CREATE INDEX IF NOT EXISTS discord_event_log_pending_idx
  ON public.discord_event_log (status, created_at)
  WHERE status <> 'sent';

ALTER TABLE public.discord_event_log ENABLE ROW LEVEL SECURITY;
-- No policies: service_role writers only (createAdminSupabaseClient).
REVOKE ALL ON TABLE public.discord_event_log FROM anon, authenticated;
