-- Ops alert state for live-sync sustained-failure ntfy (hourly re-alert + recovery).
-- Service-role only; used by Next.js cron routes via createAdminSupabaseClient.

CREATE TABLE IF NOT EXISTS public.sync_ops_alert_state (
  job_type text PRIMARY KEY,
  alerted boolean NOT NULL DEFAULT false,
  last_fatal_alert_at timestamptz,
  consecutive_errors integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_ops_alert_state ENABLE ROW LEVEL SECURITY;
-- No policies: locked to service_role / SECURITY DEFINER writers only.
REVOKE ALL ON TABLE public.sync_ops_alert_state FROM anon, authenticated;
