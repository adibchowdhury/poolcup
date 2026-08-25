-- Pool creation drafts for Custom Pool checkout (create-after-payment).
-- Service-role only: RLS enabled with no client policies.

CREATE TABLE IF NOT EXISTS public.pool_creation_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  stripe_checkout_session_id text UNIQUE,
  consumed_at timestamptz,
  created_pool_id uuid REFERENCES public.pools (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pool_creation_drafts_user_id_idx
  ON public.pool_creation_drafts (user_id);

CREATE INDEX IF NOT EXISTS pool_creation_drafts_consumed_at_idx
  ON public.pool_creation_drafts (consumed_at);

ALTER TABLE public.pool_creation_drafts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pool_creation_drafts IS
  'Pre-payment Custom Pool configs. Service role only; no client policies.';
