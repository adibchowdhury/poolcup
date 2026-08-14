-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production. Idempotent where possible.
--
-- Reconciles AI Insights objects from linked prod (pg_get_functiondef / catalog).
-- Dumped 2026-08-14 via `supabase db query --linked`; grants tightened post-dump
-- to service_role only (revoked from anon AND authenticated).
--
-- LIVE ACL (functions) — service_role only:
--   build_insight_payload(uuid)     — service_role (PUBLIC/anon/authenticated revoked)
--   set_insight_feedback(uuid,text) — service_role (PUBLIC/anon/authenticated revoked)
--
-- LIVE ACL (table ai_insights) — service_role only:
--   REVOKE ALL FROM anon, authenticated; RLS ENABLED with ZERO policies.
--
-- Contents: ai_insights (+ unique user index, RLS), build_insight_payload,
-- set_insight_feedback + grants/revokes.

-- =============================================================================
-- 1. ai_insights table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  insights jsonb NOT NULL,
  stats_hash text,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  feedback text,
  feedback_at timestamptz,
  CONSTRAINT ai_insights_feedback_check
    CHECK ((feedback IS NULL) OR (feedback = ANY (ARRAY['useful'::text, 'not_useful'::text])))
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_insights_user_idx
  ON public.ai_insights USING btree (user_id);

-- Ensure check exists on rebuilds where table pre-existed without it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_insights_feedback_check'
      AND conrelid = 'public.ai_insights'::regclass
  ) THEN
    ALTER TABLE public.ai_insights
      ADD CONSTRAINT ai_insights_feedback_check
      CHECK ((feedback IS NULL) OR (feedback = ANY (ARRAY['useful'::text, 'not_useful'::text])));
  END IF;
END
$$;

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
-- No policies: row access locked; service_role / SECURITY DEFINER writers only.
REVOKE ALL ON TABLE public.ai_insights FROM anon, authenticated;

-- =============================================================================
-- 2. build_insight_payload(uuid) — verbatim pg_get_functiondef
-- =============================================================================

CREATE OR REPLACE FUNCTION public.build_insight_payload(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_all jsonb; v_recent7 jsonb; v_recent30 jsonb; v_comp jsonb; v_ts jsonb; v jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  v_all := public.get_user_analytics(p_user_id, NULL, NULL, false);
  v_recent7 := public.get_user_analytics(p_user_id, now() - interval '7 days', now(), false);
  v_recent30 := public.get_user_analytics(p_user_id, now() - interval '30 days', now(), false);
  v_comp := public.get_user_analytics_comparisons(p_user_id);
  v_ts := public.get_user_analytics_timeseries(p_user_id, NULL, NULL, false);

  -- Assemble a clean, minimal payload — user's OWN aggregates only.
  v := jsonb_build_object(
    'all_time', jsonb_build_object(
      'finalized_predictions', v_all->'finalized_predictions',
      'accuracy', v_all->'accuracy',
      'exact_rate', v_all->'exact_rate',
      'total_points', v_all->'total_points',
      'by_sport', v_all->'by_sport',
      'best_sport', v_all->'best_sport',
      'weakest_sport', v_all->'weakest_sport'
    ),
    'last_7_days', jsonb_build_object(
      'finalized_predictions', v_recent7->'finalized_predictions',
      'accuracy', v_recent7->'accuracy'
    ),
    'last_30_days', jsonb_build_object(
      'finalized_predictions', v_recent30->'finalized_predictions',
      'accuracy', v_recent30->'accuracy'
    ),
    -- recent form: last ~10 rolling accuracy points (tail of the series)
    'recent_form_tail', (
      SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(v_ts->'recent_form') WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord DESC LIMIT 10
      ) sub
    ),
    -- platform + friends AVERAGES (aggregate, not individuals) for context
    'comparison', jsonb_build_object(
      'poolcup_avg_accuracy', v_comp->'poolcup_avg_accuracy',
      'friends_avg_accuracy', v_comp->'friends_avg_accuracy'
    )
  );
  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.build_insight_payload(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.build_insight_payload(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.build_insight_payload(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.build_insight_payload(uuid) TO service_role;

-- =============================================================================
-- 3. set_insight_feedback(uuid, text) — verbatim pg_get_functiondef
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_insight_feedback(p_user_id uuid, p_feedback text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_feedback NOT IN ('useful','not_useful') THEN RAISE EXCEPTION 'invalid_feedback'; END IF;
  UPDATE public.ai_insights SET feedback = p_feedback, feedback_at = now() WHERE user_id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_insight_feedback(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_insight_feedback(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_insight_feedback(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_insight_feedback(uuid, text) TO service_role;
